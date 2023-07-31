//
//  internal.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2023 O2ter Limited. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//

import _ from 'lodash';
import { Readable } from 'node:stream';
import { defaultSchema } from './defaults';
import { Proto, ProtoOptions, ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from './index';
import {
  PVK,
  TFile,
  ExtraOptions,
  ProtoInternalType,
  FileData,
  isFileBuffer,
  isFileStream,
  base64ToBuffer,
  TObject,
} from '../internals';
import { generateId } from './crypto';
import { TSchema } from './schema';
import { QueryValidator } from './query/validator/validator';

const validateSchema = (schema: Record<string, TSchema>) => {

  if (!_.isNil(schema['_Schema'])) throw Error('Reserved name of class');

  for (const [className, _schema] of _.toPairs(schema)) {

    if (!className.match(QueryValidator.patterns.name)) throw Error(`Invalid class name: ${className}`);

    const fields = _.keys(_schema.fields);
    for (const key of fields) {
      if (!key.match(QueryValidator.patterns.name)) throw Error(`Invalid field name: ${key}`);
    }
    for (const key of _.keys(_schema.fieldLevelPermissions)) {
      if (!fields.includes(key)) throw Error(`Invalid field permission: ${key}`);
    }
  }
}

const mergeSchema = (...schemas: Record<string, TSchema>[]) => _.reduce(schemas, (acc, schema) => ({
  ...acc,
  ..._.mapValues(schema, (s, className) => ({
    fields: {
      ..._.omit(s.fields, ...TObject.defaultKeys),
      ...(acc[className]?.fields ?? {}),
    },
    classLevelPermissions: _.mergeWith(
      acc[className]?.classLevelPermissions,
      s.classLevelPermissions,
      (l, r) => _.isArray(l) ? [...l, ...r] : undefined,
    ),
    fieldLevelPermissions: _.mergeWith(
      acc[className]?.fieldLevelPermissions,
      s.fieldLevelPermissions,
      (l, r) => _.isArray(l) ? [...l, ...r] : undefined,
    ),
    indexes: [
      ...(acc[className]?.indexes ?? [
        { keys: { _acl: 1 } },
        { keys: { _expired_at: 1 } },
      ]),
      ...(s.indexes ?? []),
    ],
  })),
}), {} as Record<string, TSchema>);

export class ProtoInternal<Ext> implements ProtoInternalType<Ext> {

  proto: Proto<Ext>;
  options: Required<ProtoOptions<Ext>>;

  functions: Record<string, ProtoFunction<Ext> | ProtoFunctionOptions<Ext>>;
  triggers: {
    beforeSave?: Record<string, ProtoTrigger<string, Ext>>;
    afterSave?: Record<string, ProtoTrigger<string, Ext>>;
    beforeDelete?: Record<string, ProtoTrigger<string, Ext>>;
    afterDelete?: Record<string, ProtoTrigger<string, Ext>>;
    beforeSaveFile?: ProtoTrigger<'_File', Ext>;
    afterSaveFile?: ProtoTrigger<'_File', Ext>;
    beforeDeleteFile?: ProtoTrigger<'_File', Ext>;
    afterDeleteFile?: ProtoTrigger<'_File', Ext>;
  };

  constructor(proto: Proto<Ext>, options: Required<ProtoOptions<Ext>>) {
    validateSchema(options.schema);
    this.proto = proto;
    this.options = {
      ...options,
      schema: mergeSchema(defaultSchema, options.fileStorage.schema, options.schema),
    };
    this.functions = {};
    this.triggers = {};
  }

  async prepare() {
    await this.options.storage.prepare(this.options.schema);
  }

  generateId() {
    return generateId(this.options.objectIdSize);
  }

  async run(name: string, payload: any, options?: ExtraOptions) {

    const func = this.functions?.[name];

    if (_.isNil(func)) throw Error('Function not found');
    if (_.isFunction(func)) return func(payload ?? this.proto);

    const { callback, validator } = func;

    if (!!validator?.requireUser && !this.proto.user) throw Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw Error('No permission');
    if (!_.some(validator?.requireAnyUserRoles, x => _.includes(this.proto.roles, x))) throw Error('No permission');
    if (_.some(validator?.requireAllUserRoles, x => !_.includes(this.proto.roles, x))) throw Error('No permission');

    return callback(payload ?? this.proto);
  }

  async updateFile(object: TFile, options?: ExtraOptions) {

    const updated = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .findOneAndUpdate(object[PVK].mutated);

    if (updated) {
      object[PVK].attributes = updated.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async createFile(object: TFile, options?: ExtraOptions) {

    const data = object[PVK].extra.data as FileData | { _id: string; size: number; };
    if (_.isNil(data)) throw Error('Invalid file object');

    let file: { _id: string; size: number; } | undefined;

    const info = {
      mimeType: object.get('type') as string,
      filename: object.get('filename') as string,
    };

    if (_.isString(data) || isFileBuffer(data) || isFileStream(data)) {
      file = await this.proto.fileStorage.create(this.proto, data, info);
    } else if ('base64' in data) {
      const buffer = base64ToBuffer(data.base64);
      file = await this.proto.fileStorage.create(this.proto, buffer, info);
    } else if ('_id' in data && 'size' in data) {
      file = data;
    } else {
      throw Error('Invalid file object');
    }

    try {

      object.set('token', file._id);
      object.set('size', file.size);

      const created = await this.proto.Query(object.className, options)
        .insert(_.fromPairs(object.keys().map(k => [k, object.get(k)])));

      if (created) {
        object[PVK].attributes = created.attributes;
        object[PVK].mutated = {};
        object[PVK].extra = {};
      }

      return object;

    } catch (e) {
      this.destoryFileData(this.proto, file._id);
      throw e;
    }
  }

  async saveFile(object: TFile, options?: ExtraOptions) {

    const beforeSave = this.triggers?.beforeSaveFile;
    const afterSave = this.triggers?.afterSaveFile;

    const context = options?.context ?? {};

    if (_.isFunction(beforeSave)) {
      await beforeSave(Object.setPrototypeOf({ object, context }, this.proto));
    }

    if (object.objectId) {
      object = await this.updateFile(object, options);
    } else {
      object = await this.createFile(object, options);
    }

    if (_.isFunction(afterSave)) {
      await afterSave(Object.setPrototypeOf({ object, context }, this.proto));
    }

    return object;
  }

  async deleteFile(object: TFile, options?: ExtraOptions) {

    const beforeDelete = this.triggers?.beforeDeleteFile;
    const afterDelete = this.triggers?.afterDeleteFile;

    object = await object.fetchIfNeeded(['token'], options);
    const context = options?.context ?? {};

    if (_.isFunction(beforeDelete)) {
      await beforeDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    const deleted = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .findOneAndDelete();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    this.destoryFileData(this.proto, object.token);

    if (_.isFunction(afterDelete)) {
      await afterDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    return object;
  }

  fileData(object: TFile, options?: ExtraOptions) {
    const self = this;
    return Readable.from({
      [Symbol.asyncIterator]: async function* () {
        object = await object.fetchIfNeeded(['token'], options);
        const chunks = self.options.fileStorage.fileData(self.proto, object.attributes.token as string);
        yield* chunks;
      }
    });
  }

  destoryFileData(proto: Proto<Ext>, id: string) {
    (async () => {
      try {
        await this.proto.fileStorage.destory(this.proto, id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

}
