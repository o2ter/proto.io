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
import jwt from 'jsonwebtoken';
import { Blob } from 'node:buffer';
import { Readable } from 'node:stream';
import { defaultSchema } from './defaults';
import { ProtoServiceOptions, ProtoServiceKeyOptions } from './types';
import { ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from '../../internals/proto/types';
import { generateId } from '../crypto/random';
import { TSchema, defaultObjectKeyTypes, isPointer, isPrimitive, isRelation, isShapedObject } from '../../internals/schema';
import { QueryValidator } from '../query/dispatcher/validator';
import { passwordHash, varifyPassword } from '../crypto/password';
import { proxy } from './proxy';
import { ProtoService } from '.';
import { base64ToBuffer, isBinaryData } from '@o2ter/utils-js';
import { EventCallback, ProtoInternalType } from '../../internals/proto';
import { TObject } from '../../internals/object';
import { _TValue } from '../../internals/query/value';
import { ExtraOptions } from '../../internals/options';
import { TUser } from '../../internals/object/user';
import { TFile } from '../../internals/object/file';
import { FileData } from '../../internals/buffer';
import { PVK } from '../../internals/private';
import { fetchUserPerms } from '../query/dispatcher';

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
    event: acc[className]?.event ?? s.event,
  })),
}), {} as Record<string, TSchema>);

export class ProtoInternal<Ext, P extends ProtoService<Ext>> implements ProtoInternalType<Ext, P> {

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

  async config(proto: P, options?: { master?: boolean; }) {
    return this.options.storage.config(options?.master ? undefined : _.uniq(['*', ...await fetchUserPerms(proto)]));
  }
  configAcl() {
    return this.options.storage.configAcl();
  }
  async setConfig(values: Record<string, _TValue>, acl?: string[]) {
    return this.options.storage.setConfig(values, acl);
  }

  async run(proto: P, name: string, payload: any, options?: ExtraOptions<boolean, P>) {

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

  async varifyPassword(proto: P, user: TUser, password: string, options: ExtraOptions<true, P>) {
    if (!user.objectId) throw Error('Invalid user object');
    const _user = await proto.InsecureQuery('User')
      .equalTo('_id', user.objectId)
      .includes('_id', 'password')
      .first(options);
    const { alg, ...opts } = _user?.get('password') ?? {};
    return varifyPassword(alg, password, opts);
  }

  async setPassword(proto: P, user: TUser, password: string, options: ExtraOptions<true, P>) {
    if (!user.objectId) throw Error('Invalid user object');
    if (_.isEmpty(password)) throw Error('Invalid password');
    const { alg, ...opts } = this.options.passwordHashOptions;
    const hashed = await passwordHash(alg, password, opts);
    await proto.InsecureQuery('User')
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: hashed },
      }, options);
  }

  async unsetPassword(proto: P, user: TUser, options: ExtraOptions<true, P>) {
    if (!user.objectId) throw Error('Invalid user object');
    await proto.InsecureQuery('User')
      .equalTo('_id', user.objectId)
      .includes('_id')
      .updateOne({
        password: { $set: {} },
      }, options);
  }

  async updateFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P>) {

    if ('filename' in object[PVK].mutated && _.isEmpty(object.get('filename'))) {
      throw Error('Invalid filename');
    }

    const updated = await proto.Query(object.className)
      .equalTo('_id', object.objectId)
      .includes(...object.keys())
      .updateOne(object[PVK].mutated, options);

    if (updated) {
      object[PVK].attributes = updated.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  varifyUploadToken(proto: P, token?: string, isMaster?: boolean) {

    const {
      nonce,
      maxUploadSize
    } = (_.isString(token) ? this.jwtVarify('upload', token) ?? {} : {}) as {
      nonce?: string;
      maxUploadSize?: number;
    };
    if (!isMaster && !nonce) throw Error('Upload token is required');

    return {
      nonce,
      maxUploadSize: maxUploadSize ?? proto[PVK].options.maxUploadSize,
    };
  }

  async createFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P> & { uploadToken?: string; }) {

    const data = object[PVK].extra.data as FileData | { _id: string; size: number; };
    if (_.isNil(data)) throw Error('Invalid file object');

    const { nonce, maxUploadSize } = this.varifyUploadToken(proto, options?.uploadToken, options?.master);

    if (nonce) {
      const found = await proto.Query('File').equalTo('nonce', nonce).first({ master: true });
      if (found) throw Error('Invalid upload token');
    }

    let file: { _id: string; size: number; } | undefined;

    const info = {
      mimeType: object.get('type'),
      filename: object.get('filename'),
    };

    if (_.isEmpty(info.filename)) {
      throw Error('Invalid filename');
    }

    if (_.isString(data)) {
      file = await proto.fileStorage.create(proto, Buffer.from(data), info, maxUploadSize);
    } else if (isBinaryData(data) || data instanceof Readable) {
      file = await proto.fileStorage.create(proto, data, info, maxUploadSize);
    } else if (data instanceof Blob) {
      file = await proto.fileStorage.create(proto, await data.arrayBuffer(), info, maxUploadSize);
    } else if ('base64' in data) {
      const buffer = base64ToBuffer(data.base64);
      file = await proto.fileStorage.create(proto, buffer, info, maxUploadSize);
    } else if ('_id' in data && 'size' in data) {
      file = data;
    } else {
      throw Error('Invalid file object');
    }

    try {

      object.set('token', file._id);
      object.set('size', file.size);
      if (nonce) object.set('nonce', nonce);

      const created = await proto.Query('File')
        .includes(...object.keys())
        .insert(_.fromPairs([...object.entries()]), options);

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

  async saveFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P>) {

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

  async deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P>) {

    const beforeDelete = this.triggers?.beforeDeleteFile;
    const afterDelete = this.triggers?.afterDeleteFile;

    object = await object.fetchIfNeeded(['token'], options);
    const context = options?.context ?? {};

    if (_.isFunction(beforeDelete)) {
      await beforeDelete(proxy(Object.setPrototypeOf({ object, context }, proto)));
    }

    const deleted = await proto.Query('File')
      .equalTo('_id', object.objectId)
      .deleteOne(options);

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

  fileData(proto: P, object: TFile, options?: ExtraOptions<boolean, P>) {
    const self = this;
    return Readable.from({
      [Symbol.asyncIterator]: async function* () {
        object = await object.fetchIfNeeded(['token'], options);
        const chunks = self.options.fileStorage.fileData(proto, object.attributes.token as string);
        yield* chunks;
      }
    });
  }

  destoryFileData(proto: P, id: string) {
    (async () => {
      try {
        await proto.fileStorage.destory(proto, id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

  _jwtSign(payload: any, options: jwt.SignOptions) {
    return jwt.sign(payload, this.options.jwtToken, options);
  }

  _jwtVarify(token: string, options: jwt.VerifyOptions = {}) {
    try {
      const payload = jwt.verify(token, this.options.jwtToken, { ...options, complete: false });
      if (!_.isObject(payload)) return;
      return payload;
    } catch {
      return;
    }
  }

  jwtSign(type: 'login' | 'upload', payload: any, options?: jwt.SignOptions) {
    return this._jwtSign(payload, options ?? {
      'login': this.options.jwtSignOptions,
      'upload': this.options.jwtUploadSignOptions,
    }[type]);
  }

  jwtVarify(type: 'login' | 'upload', token: string) {
    return this._jwtVarify(token, {
      'login': this.options.jwtVerifyOptions,
      'upload': this.options.jwtUploadVerifyOptions,
    }[type]);
  }

  async notify(
    type: 'create' | 'update' | 'delete',
    objects: TObject | TObject[],
  ) {
    const objs = _.map(_.castArray(objects), x => ({
      className: x.className,
      attributes: _.pick(x.attributes as Record<string, _TValue>, TObject.defaultKeys)
    }));
    return this.options.pubsub.publish({ type, objects: objs });
  }

  listen(proto: P, callback: EventCallback) {
    const isMaster = proto.isMaster;
    const roles = isMaster ? [] : proto.currentRoles();
    return this.options.pubsub.subscribe(payload => {
      const { type, objects } = payload as any;
      (async () => {
        const _roles = await roles;
        const objs = isMaster ? objects : _.filter(objects, x => _.some(x.attributes._rperm, x => _.includes(_roles, x)));
        if (_.isEmpty(objs)) return;
        callback(type, _.map(objs, x => new TObject(x.className, x.attributes)));
      })();
    });
  }
}
