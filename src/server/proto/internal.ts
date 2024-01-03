//
//  internal.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { Blob } from 'node:buffer';
import { Readable } from 'node:stream';
import { defaultSchema } from './defaults';
import { ProtoService } from './index';
import { ProtoServiceOptions, ProtoFunction, ProtoFunctionOptions, ProtoTrigger, ProtoServiceKeyOptions } from './types';
import {
  PVK,
  TFile,
  ExtraOptions,
  ProtoInternalType,
  FileData,
  isBinaryData,
  base64ToBuffer,
  TObject,
  TUser,
  _TValue,
} from '../../internals';
import { generateId } from '../crypto/random';
import { TSchema, defaultObjectKeyTypes, isPrimitive, isRelation } from '../../internals/schema';
import { QueryValidator } from '../query/validator/validator';
import { passwordHash, varifyPassword } from '../crypto/password';

const validateSchema = (schema: Record<string, TSchema>) => {

  if (!_.isNil(schema['_Schema']) || !_.isNil(schema['_Config'])) throw Error('Reserved name of class');

  for (const [className, _schema] of _.toPairs(schema)) {

    if (!className.match(QueryValidator.patterns.name)) throw Error(`Invalid class name: ${className}`);

    for (const [key, dataType] of _.toPairs(_schema.fields)) {
      if (_.includes(TObject.defaultKeys, key)) throw Error(`Reserved field name: ${key}`);
      if (!key.match(QueryValidator.patterns.name)) throw Error(`Invalid field name: ${key}`);

      if (isRelation(dataType) && dataType.foreignField) {
        if (_.isNil(schema[dataType.target])) throw Error(`Invalid foreign field: ${key}`);
        const foreignField = schema[dataType.target].fields[dataType.foreignField];
        if (_.isNil(foreignField)) throw Error(`Invalid foreign field: ${key}`);
        if (isPrimitive(foreignField)) throw Error(`Invalid foreign field: ${key}`);
        if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid foreign field: ${key}`);
      }
    }

    const fields = _.keys(_schema.fields);
    for (const key of _.keys(_schema.fieldLevelPermissions)) {
      if (!fields.includes(key)) throw Error(`Invalid field permission: ${key}`);
    }
    for (const key of _schema.secureFields ?? []) {
      if (!fields.includes(key)) throw Error(`Invalid field permission: ${key}`);
    }
  }
}

const mergeSchema = (...schemas: Record<string, TSchema>[]) => _.reduce(schemas, (acc, schema) => ({
  ...acc,
  ..._.mapValues(schema, (s, className) => ({
    fields: {
      ...defaultObjectKeyTypes,
      ...(acc[className]?.fields ?? {}),
      ...s.fields,
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
    secureFields: [
      ...(acc[className]?.secureFields ?? []),
      ...(s.secureFields ?? []),
    ],
    indexes: [
      ...(acc[className]?.indexes ?? [
        { keys: { _rperm: 1 } },
        { keys: { _wperm: 1 } },
        { keys: { _expired_at: 1 } },
      ]),
      ...(s.indexes ?? []),
    ],
  })),
}), {} as Record<string, TSchema>);

export class ProtoInternal<Ext> implements ProtoInternalType<Ext> {

  proto: ProtoService<Ext>;
  options: Required<ProtoServiceOptions<Ext>> & ProtoServiceKeyOptions;

  functions: Record<string, ProtoFunction<Ext> | ProtoFunctionOptions<Ext>> = {};
  triggers: {
    beforeSave?: Record<string, ProtoTrigger<string, Ext>>;
    afterSave?: Record<string, ProtoTrigger<string, Ext>>;
    beforeDelete?: Record<string, ProtoTrigger<string, Ext>>;
    afterDelete?: Record<string, ProtoTrigger<string, Ext>>;
    beforeSaveFile?: ProtoTrigger<'File', Ext>;
    afterSaveFile?: ProtoTrigger<'File', Ext>;
    beforeDeleteFile?: ProtoTrigger<'File', Ext>;
    afterDeleteFile?: ProtoTrigger<'File', Ext>;
  } = {};

  constructor(proto: ProtoService<Ext>, options: Required<ProtoServiceOptions<Ext>> & ProtoServiceKeyOptions) {
    validateSchema(options.schema);
    this.proto = proto;
    this.options = {
      ...options,
      schema: mergeSchema(defaultSchema, options.fileStorage.schema, options.schema),
    };
  }

  async prepare() {
    await this.options.storage.prepare(this.options.schema);
  }

  generateId() {
    return generateId(this.options.objectIdSize);
  }

  async config() {
    return this.options.storage.config();
  }
  async setConfig(values: Record<string, _TValue>) {
    return this.options.storage.setConfig(values);
  }

  async run(name: string, payload: any, options?: ExtraOptions) {

    const func = this.functions?.[name];

    if (_.isNil(func)) throw Error('Function not found');
    if (_.isFunction(func)) return func(payload ?? this.proto);

    const { callback, validator } = func;

    const roles = await this.proto.currentRoles();

    if (!!validator?.requireUser && !this.proto.currentUser) throw Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw Error('No permission');
    if (!_.some(validator?.requireAnyUserRoles, x => _.includes(roles, x))) throw Error('No permission');
    if (_.some(validator?.requireAllUserRoles, x => !_.includes(roles, x))) throw Error('No permission');

    return callback(payload ?? this.proto);
  }

  async varifyPassword(user: TUser, password: string, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    const _user = await this.proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id', 'password')
      .first();
    const { alg, ...opts } = _user?.get('password') ?? {};
    return varifyPassword(alg, password, opts);
  }

  async setPassword(user: TUser, password: string, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    if (_.isEmpty(password)) throw Error('Invalid password');
    const { alg, ...opts } = this.options.passwordHashOptions;
    const hashed = await passwordHash(alg, password, opts);
    await this.proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: hashed },
      });
  }

  async unsetPassword(user: TUser, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    await this.proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: {} },
      });
  }

  async updateFile(object: TFile, options?: ExtraOptions) {

    const updated = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .includes(...object.keys())
      .updateOne(object[PVK].mutated);

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
      mimeType: object.get('type'),
      filename: object.get('filename'),
    };

    if (_.isString(data)) {
      file = await this.proto.fileStorage.create(this.proto, Buffer.from(data), info);
    } else if (isBinaryData(data) || data instanceof Readable) {
      file = await this.proto.fileStorage.create(this.proto, data, info);
    } else if (data instanceof Blob) {
      file = await this.proto.fileStorage.create(this.proto, await data.arrayBuffer(), info);
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
        .includes(...object.keys())
        .insert(_.fromPairs(object.keys().map(k => [k, object.get(k)])));

      if (created) {
        object[PVK].attributes = created.attributes;
        object[PVK].mutated = {};
        object[PVK].extra = {};
      }

      return object;

    } catch (e) {
      this.destoryFileData(file._id);
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
      .deleteOne();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    this.destoryFileData(object.token!);

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

  destoryFileData(id: string) {
    (async () => {
      try {
        await this.proto.fileStorage.destory(this.proto, id);
      } catch (e) {
        console.error(e);
      }
    })();
  }
}
