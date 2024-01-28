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
import { TSchema, defaultObjectKeyTypes, isPointer, isPrimitive, isRelation, isShapedObject } from '../../internals/schema';
import { QueryValidator } from '../query/validator/validator';
import { passwordHash, varifyPassword } from '../crypto/password';
import { proxy } from './proxy';

const validateForeignField = (schema: Record<string, TSchema>, key: string, dataType: TSchema.RelationType) => {
  if (!dataType.foreignField) return;
  if (_.isNil(schema[dataType.target])) throw Error(`Invalid foreign field: ${key}`);
  const foreignField = schema[dataType.target].fields[dataType.foreignField];
  if (_.isNil(foreignField)) throw Error(`Invalid foreign field: ${key}`);
  if (isPrimitive(foreignField)) throw Error(`Invalid foreign field: ${key}`);
  if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid foreign field: ${key}`);
}

const validateShapedObject = (schema: Record<string, TSchema>, dataType: TSchema.ShapedObject) => { 
  for (const [key, type] of _.entries(dataType.shape)) {
    if (!key.match(QueryValidator.patterns.name)) throw Error(`Invalid field name: ${key}`);
    if (isShapedObject(type)) {
      validateShapedObject(schema, type);
    } else if (isRelation(type)) {
      validateForeignField(schema, key, type);
    }
  }
}

const validateSchema = (schema: Record<string, TSchema>) => {

  if (!_.isNil(schema['_Schema']) || !_.isNil(schema['_Config'])) throw Error('Reserved name of class');

  for (const [className, _schema] of _.toPairs(schema)) {

    if (!className.match(QueryValidator.patterns.name)) throw Error(`Invalid class name: ${className}`);

    for (const [key, dataType] of _.toPairs(_schema.fields)) {
      if (_.includes(TObject.defaultKeys, key)) throw Error(`Reserved field name: ${key}`);
      if (!key.match(QueryValidator.patterns.name)) throw Error(`Invalid field name: ${key}`);
      if (isShapedObject(dataType)) {
        validateShapedObject(schema, dataType);
      } else if (isPointer(dataType)) {
        if (_.isNil(defaultSchema[dataType.target] ?? schema[dataType.target])) throw Error(`Invalid target: ${key}`);
      } else if (isRelation(dataType)) {
        if (_.isNil(defaultSchema[dataType.target] ?? schema[dataType.target])) throw Error(`Invalid target: ${key}`);
        validateForeignField(schema, key, dataType);
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

  constructor(options: Required<ProtoServiceOptions<Ext>> & ProtoServiceKeyOptions) {
    validateSchema(options.schema);
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

  async run(proto: ProtoService<Ext>, name: string, payload: any, options?: ExtraOptions) {

    const func = this.functions?.[name];

    if (_.isNil(func)) throw Error('Function not found');
    if (_.isFunction(func)) return func(proxy(payload ?? proto));

    const { callback, validator } = func;

    const roles = await proto.currentRoles();

    if (!!validator?.requireUser && !(await proto.currentUser())) throw Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw Error('No permission');
    if (_.isArray(validator?.requireAnyUserRoles) && !_.some(validator?.requireAnyUserRoles, x => _.includes(roles, x))) throw Error('No permission');
    if (_.isArray(validator?.requireAllUserRoles) && _.some(validator?.requireAllUserRoles, x => !_.includes(roles, x))) throw Error('No permission');

    return callback(proxy(payload ?? proto));
  }

  async varifyPassword(proto: ProtoService<Ext>, user: TUser, password: string, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    const _user = await proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id', 'password')
      .first();
    const { alg, ...opts } = _user?.get('password') ?? {};
    return varifyPassword(alg, password, opts);
  }

  async setPassword(proto: ProtoService<Ext>, user: TUser, password: string, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    if (_.isEmpty(password)) throw Error('Invalid password');
    const { alg, ...opts } = this.options.passwordHashOptions;
    const hashed = await passwordHash(alg, password, opts);
    await proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: hashed },
      });
  }

  async unsetPassword(proto: ProtoService<Ext>, user: TUser, options: ExtraOptions & { master: true }) {
    if (!user.objectId) throw Error('Invalid user object');
    await proto.InsecureQuery('User', options)
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: {} },
      });
  }

  async updateFile(proto: ProtoService<Ext>, object: TFile, options?: ExtraOptions) {

    const updated = await proto.Query(object.className, options)
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

  async createFile(proto: ProtoService<Ext>, object: TFile, options?: ExtraOptions) {

    const data = object[PVK].extra.data as FileData | { _id: string; size: number; };
    if (_.isNil(data)) throw Error('Invalid file object');

    let file: { _id: string; size: number; } | undefined;

    const info = {
      mimeType: object.get('type'),
      filename: object.get('filename'),
    };

    if (_.isString(data)) {
      file = await proto.fileStorage.create(proto, Buffer.from(data), info);
    } else if (isBinaryData(data) || data instanceof Readable) {
      file = await proto.fileStorage.create(proto, data, info);
    } else if (data instanceof Blob) {
      file = await proto.fileStorage.create(proto, await data.arrayBuffer(), info);
    } else if ('base64' in data) {
      const buffer = base64ToBuffer(data.base64);
      file = await proto.fileStorage.create(proto, buffer, info);
    } else if ('_id' in data && 'size' in data) {
      file = data;
    } else {
      throw Error('Invalid file object');
    }

    try {

      object.set('token', file._id);
      object.set('size', file.size);

      const created = await proto.Query(object.className, options)
        .includes(...object.keys())
        .insert(_.fromPairs(object.keys().map(k => [k, object.get(k)])));

      if (created) {
        object[PVK].attributes = created.attributes;
        object[PVK].mutated = {};
        object[PVK].extra = {};
      }

      return object;

    } catch (e) {
      this.destoryFileData(proto, file._id);
      throw e;
    }
  }

  async saveFile(proto: ProtoService<Ext>, object: TFile, options?: ExtraOptions) {

    const beforeSave = this.triggers?.beforeSaveFile;
    const afterSave = this.triggers?.afterSaveFile;

    const context = options?.context ?? {};

    if (_.isFunction(beforeSave)) {
      await beforeSave(proxy(Object.setPrototypeOf({ object, context }, proto)));
    }

    if (object.objectId) {
      object = await this.updateFile(proto, object, options);
    } else {
      object = await this.createFile(proto, object, options);
    }

    if (_.isFunction(afterSave)) {
      await afterSave(proxy(Object.setPrototypeOf({ object, context }, proto)));
    }

    return object;
  }

  async deleteFile(proto: ProtoService<Ext>, object: TFile, options?: ExtraOptions) {

    const beforeDelete = this.triggers?.beforeDeleteFile;
    const afterDelete = this.triggers?.afterDeleteFile;

    object = await object.fetchIfNeeded(['token'], options);
    const context = options?.context ?? {};

    if (_.isFunction(beforeDelete)) {
      await beforeDelete(proxy(Object.setPrototypeOf({ object, context }, proto)));
    }

    const deleted = await proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .deleteOne();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    this.destoryFileData(proto, object.token!);

    if (_.isFunction(afterDelete)) {
      await afterDelete(proxy(Object.setPrototypeOf({ object, context }, proto)));
    }

    return object;
  }

  fileData(proto: ProtoService<Ext>, object: TFile, options?: ExtraOptions) {
    const self = this;
    return Readable.from({
      [Symbol.asyncIterator]: async function* () {
        object = await object.fetchIfNeeded(['token'], options);
        const chunks = self.options.fileStorage.fileData(proto, object.attributes.token as string);
        yield* chunks;
      }
    });
  }

  destoryFileData(proto: ProtoService<Ext>, id: string) {
    (async () => {
      try {
        await proto.fileStorage.destory(proto, id);
      } catch (e) {
        console.error(e);
      }
    })();
  }
}
