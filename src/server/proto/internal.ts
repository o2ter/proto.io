//
//  internal.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { ProtoFunction, ProtoFunctionOptions, ProtoJobFunction, ProtoJobFunctionOptions, ProtoTriggerFunction } from '../../internals/proto/types';
import { generateId } from '../crypto/random';
import { TSchema, _typeof, defaultObjectKeyTypes, isPointer, isPrimitive, isRelation, isShape } from '../../internals/schema';
import { resolveDataType, QueryValidator } from '../query/dispatcher/validator';
import { passwordHash, varifyPassword } from '../crypto/password';
import { proxy } from './proxy';
import { _serviceOf, ProtoService } from '.';
import { base64ToBuffer, isBinaryData, prototypes } from '@o2ter/utils-js';
import { ProtoInternalType } from '../../internals/proto';
import { TObject } from '../../internals/object';
import { TValueWithoutObject, TValue } from '../../internals/types';
import { ExtraOptions } from '../../internals/options';
import { TUser } from '../../internals/object/user';
import { TFile } from '../../internals/object/file';
import { FileData } from '../../internals/buffer';
import { PVK } from '../../internals/private';
import { fetchUserPerms } from '../query/dispatcher';
import { EventData } from '../../internals/proto';
import { normalize } from '../utils';
import { PROTO_LIVEQUERY_MSG, PROTO_NOTY_MSG } from '../../internals/const';
import { TJob } from '../../internals/object/job';
import { deserialize, serialize } from '../../internals/codec';
import { ProtoQuery } from '../query';
import { TQuerySelector } from '../../internals/query/types/selectors';
import { QuerySelector } from '../query/dispatcher/parser';

const validateForeignField = (schema: Record<string, TSchema>, key: string, dataType: TSchema.RelationType) => {
  if (!dataType.foreignField) return;
  if (_.isNil(schema[dataType.target])) throw Error(`Invalid foreign field: ${key}`);
  const foreignField = resolveDataType(schema, dataType.target, dataType.foreignField);
  if (_.isNil(foreignField)) throw Error(`Invalid foreign field: ${key}`);
  if (isPrimitive(foreignField)) throw Error(`Invalid foreign field: ${key}`);
  if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid foreign field: ${key}`);
}

const validateShapedObject = (schema: Record<string, TSchema>, dataType: TSchema.ShapeType) => {
  if (_.isEmpty(dataType.shape)) throw Error('Invalid empty shape');
  for (const [key, type] of _.entries(dataType.shape)) {
    if (!key.match(QueryValidator.patterns.fieldName)) throw Error(`Invalid field name: ${key}`);
    if (isShape(type)) {
      validateShapedObject(schema, type);
    } else if (isRelation(type)) {
      validateForeignField(schema, key, type);
    }
  }
}

const validateSchemaName = (schema: Record<string, TSchema>) => {
  for (const name of ['_Schema', '_Config']) {
    if (!_.isNil(schema[name])) throw Error('Reserved name of class');
  }
  for (const [, _schema] of _.toPairs(schema)) {
    for (const [key] of _.toPairs(_schema.fields)) {
      if (_.includes(TObject.defaultKeys, key)) throw Error(`Reserved field name: ${key}`);
    }
  }
}

const validateSchema = (schema: Record<string, TSchema>) => {
  for (const [className, _schema] of _.toPairs(schema)) {

    if (!className.match(QueryValidator.patterns.className)) throw Error(`Invalid class name: ${className}`);

    for (const [key, dataType] of _.toPairs(_schema.fields)) {
      if (!key.match(QueryValidator.patterns.fieldName)) throw Error(`Invalid field name: ${key}`);
      if (isShape(dataType)) {
        validateShapedObject(schema, dataType);
      } else if (isPointer(dataType)) {
        if (_.isNil(defaultSchema[dataType.target] ?? schema[dataType.target])) throw Error(`Invalid target: ${key}`);
      } else if (isRelation(dataType)) {
        if (_.isNil(defaultSchema[dataType.target] ?? schema[dataType.target])) throw Error(`Invalid target: ${key}`);
        validateForeignField(schema, key, dataType);
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
      acc[className]?.classLevelPermissions ?? {},
      s.classLevelPermissions,
      (l, r) => _.isArray(l) ? [...l, ...r] : undefined,
    ),
    additionalObjectPermissions: _.mergeWith(
      acc[className]?.additionalObjectPermissions ?? {},
      s.additionalObjectPermissions,
      (l, r) => _.isArray(l) ? [...l, ...r] : undefined,
    ),
    fieldLevelPermissions: _.mergeWith(
      acc[className]?.fieldLevelPermissions ?? {},
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
        { keys: { _created_at: 1 } },
        { keys: { _updated_at: 1 } },
        { keys: { _expired_at: 1 } },
      ]),
      ...(s.indexes ?? []),
    ],
    liveQuery: acc[className]?.liveQuery || s.liveQuery,
  })),
}), {} as Record<string, TSchema>);

export class ProtoInternal<Ext, P extends ProtoService<Ext>> implements ProtoInternalType<Ext, P> {

  options: Required<ProtoServiceOptions<Ext>> & ProtoServiceKeyOptions;

  functions: Record<string, ProtoFunction<Ext, any, any> | ProtoFunctionOptions<Ext>> = {};
  triggers: Record<string, {
    create: ProtoTriggerFunction<any, Ext>[];
    update: ProtoTriggerFunction<any, Ext>[];
    delete: ProtoTriggerFunction<any, Ext>[];
  }> = {};
  jobs: Record<string, ProtoJobFunction<Ext, any> | ProtoJobFunctionOptions<Ext>> = {};

  jobRunner = new JobRunner<Ext, P>();

  constructor(options: Required<ProtoServiceOptions<Ext>> & ProtoServiceKeyOptions) {
    validateSchemaName(options.schema);
    const schema = mergeSchema(defaultSchema, options.fileStorage.schema, options.schema);
    validateSchema(schema);
    if (!_.every(options.roleResolver?.inheritKeys, k => {
      const type = resolveDataType(schema, 'Role', k);
      return type && isRelation(type) && _.includes(['User', 'Role'], type.target);
    })) {
      throw Error(`Invalid role keys`);
    }
    this.options = {
      ...options,
      schema,
    };
  }

  async prepare() {
    await this.options.storage.prepare(this.options.schema);
  }

  shutdown() {
    this.jobRunner.shutdown();
  }

  generateId() {
    return generateId(this.options.objectIdSize);
  }

  private async _perms(proto: P) {
    return _.uniq(['*', ...await fetchUserPerms(proto)]);
  }

  async config(proto: P, options?: { master?: boolean; }) {
    return this.options.storage.config(options?.master ? undefined : await this._perms(proto));
  }
  configAcl() {
    return this.options.storage.configAcl();
  }
  async setConfig(values: Record<string, TValueWithoutObject>, acl?: string[]) {
    return this.options.storage.setConfig(normalize(values), normalize(acl));
  }

  async run(proto: P, name: string, payload: any, options?: ExtraOptions<boolean>) {

    const func = this.functions[name];

    if (_.isNil(func)) throw Error('Function not found');
    if (_.isFunction(func)) return func(proxy(payload ?? proto));

    const { callback, validator } = func;

    const roles = await proto.currentRoles();

    if (!options?.master) {
      if (!!validator?.requireUser && !(await proto.currentUser())) throw Error('No permission');
      if (!!validator?.requireMaster) throw Error('No permission');
      if (_.isArray(validator?.requireAnyUserRoles) && !_.some(validator?.requireAnyUserRoles, x => _.includes(roles, x))) throw Error('No permission');
      if (_.isArray(validator?.requireAllUserRoles) && _.some(validator?.requireAllUserRoles, x => !_.includes(roles, x))) throw Error('No permission');
    }

    return callback(proxy(payload ?? proto));
  }

  async varifyPassword(proto: P, user: TUser, password: string, options: ExtraOptions<true>) {
    if (!user.id) throw Error('Invalid user object');
    const _user = await proto.InsecureQuery('User')
      .equalTo('_id', user.id)
      .includes('_id', 'password')
      .first(options);
    const { alg, ...opts } = _user?.get('password') ?? {};
    return varifyPassword(alg, password, opts);
  }

  async setPassword(proto: P, user: TUser, password: string, options: ExtraOptions<true>) {
    if (!user.id) throw Error('Invalid user object');
    if (_.isEmpty(password)) throw Error('Invalid password');
    const { alg, ...opts } = this.options.passwordHashOptions;
    const hashed = await passwordHash(alg, password, opts);
    await proto.InsecureQuery('User')
      .equalTo('_id', user.id)
      .includes('_id')
      .updateOne({
        password: { $set: hashed },
      }, options);
  }

  async unsetPassword(proto: P, user: TUser, options: ExtraOptions<true>) {
    if (!user.id) throw Error('Invalid user object');
    await proto.InsecureQuery('User')
      .equalTo('_id', user.id)
      .includes('_id')
      .updateOne({
        password: { $set: {} },
      }, options);
  }

  async updateFile(proto: P, object: TFile, options?: ExtraOptions<boolean>) {

    if ('filename' in object[PVK].mutated && _.isEmpty(object.get('filename'))) {
      throw Error('Invalid filename');
    }

    const updated = await proto.Query(object.className)
      .equalTo('_id', object.id)
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
      attributes,
      maxUploadSize,
    } = (_.isString(token) ? this.jwtVarify(token, 'upload') ?? {} : {}) as {
      nonce?: string;
      maxUploadSize?: number;
        attributes?: Record<string, any>;
    };
    if (!isMaster && !nonce) throw Error('Upload token is required');

    return {
      nonce,
      attributes: _.isObject(attributes) ? deserialize(
        JSON.stringify(attributes),
        { objAttrs: ['_id'] },
      ) as Record<string, TValue> : {},
      maxUploadSize: maxUploadSize ?? this.options.maxUploadSize,
    };
  }

  async createFile(proto: P, object: TFile, options?: ExtraOptions<boolean> & { uploadToken?: string; }) {

    const data = object[PVK].extra.data as FileData | { _id: string; size: number; };
    if (_.isNil(data)) throw Error('Invalid file object');

    const {
      nonce,
      attributes = {},
      maxUploadSize = this.options.maxUploadSize,
    } = options?.uploadToken ? this.varifyUploadToken(proto, options.uploadToken, options.master) : {};

    if (nonce) {
      const found = await proto.Query('File').equalTo('nonce', nonce).first({ master: true });
      if (found) throw Error('Invalid upload token');
    }

    let file: { _id: string; size: number; };

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

      for (const [key, value] of _.entries(attributes)) {
        object.set(key, value);
      }
      object.set('token', file._id);
      object.set('size', file.size);
      if (nonce) object.set('nonce', nonce);

      const query = new ProtoQuery('File', proto, { createFile: true });
      const created = await query.includes(...object.keys()).insert(_.fromPairs([...object._set_entries()]), options);

      if (created) {
        object[PVK].attributes = created.attributes;
        object[PVK].mutated = {};
        object[PVK].extra = {};
      }

      return object;

    } catch (e) {
      this.destroyFileData(proto, file._id);
      throw e;
    }
  }

  async saveFile(proto: P, object: TFile, options?: ExtraOptions<boolean>) {
    if (object.id) {
      object = await this.updateFile(proto, object, options);
    } else {
      object = await this.createFile(proto, object, options);
    }
    return object;
  }

  async deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean>) {

    object = await object.fetchIfNeeded(['token'], options);

    const deleted = await proto.Query('File')
      .equalTo('_id', object.id)
      .deleteOne(options);

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    this.destroyFileData(proto, object.token!);

    return object;
  }

  fileData(proto: P, object: TFile, options?: ExtraOptions<boolean>) {
    const self = this;
    return Readable.from({
      [Symbol.asyncIterator]: async function* () {
        object = await object.fetchIfNeeded(['token'], options);
        const chunks = self.options.fileStorage.fileData(proto, object.attributes.token as string);
        yield* chunks;
      }
    });
  }

  destroyFileData(proto: P, id: string) {
    (async () => {
      try {
        await proto.fileStorage.destroy(proto, id);
      } catch (e) {
        proto.logger.error(e);
      }
    })();
  }

  jwtSign(payload: any, options: 'login' | 'upload' | jwt.SignOptions) {
    const opts = (() => {
      switch (options) {
        case 'login': return this.options.jwtSignOptions;
        case 'upload': return this.options.jwtUploadSignOptions;
        default: return options;
      }
    })();
    return jwt.sign(payload, this.options.jwtToken, opts);
  }

  jwtVarify(token: string, options: 'login' | 'upload' | jwt.VerifyOptions = {}) {
    try {
      const opts = (() => {
        switch (options) {
          case 'login': return this.options.jwtVerifyOptions;
          case 'upload': return this.options.jwtUploadVerifyOptions;
          default: return options;
        }
      })();
      const payload = jwt.verify(token, this.options.jwtToken, { ...opts, complete: false });
      if (!_.isObject(payload)) return;
      return payload;
    } catch {
      return;
    }
  }

  async notify(proto: P, data: Record<string, TValueWithoutObject> & { _rperm?: string[]; }) {
    if (data._rperm && (!_.isArray(data._rperm) || !_.every(data._rperm, _.isString))) {
      throw Error('Invalid data type');
    }
    return this.options.pubsub.publish(
      PROTO_NOTY_MSG,
      {
        ...data,
        _id: this.generateId(),
        _created_at: new Date(),
        _rperm: data._rperm || ['*'],
      }
    );
  }

  listen(proto: P, callback: (data: EventData) => void) {
    return {
      remove: this.options.pubsub.subscribe(
        PROTO_NOTY_MSG,
        payload => {
          const { _rperm } = payload as EventData;
          (async () => {
            try {
              const isMaster = proto.isMaster;
              const roles = isMaster ? [] : await this._perms(proto);
              if (!isMaster && !_.some(roles, x => _.includes(_rperm, x))) return;
              await callback(payload as EventData);
            } catch (e) {
              proto.logger.error(e);
            }
          })();
        }
      ),
    };
  }

  async publishLiveQuery(proto: P, event: string, objects: TObject[]) {
    if (_.isEmpty(objects)) return;
    return this.options.pubsub.publish(
      PROTO_LIVEQUERY_MSG,
      JSON.parse(serialize({ event, objects }, { objAttrs: TObject.defaultKeys })),
    );
  }

  _liveQuery(
    proto: P,
    callback: (event: string, objects: TObject[]) => void,
  ) {
    return {
      remove: this.options.pubsub.subscribe(
        PROTO_LIVEQUERY_MSG,
        payload => {
          const { event, objects } = deserialize(JSON.stringify(payload)) as { event: string; objects: TObject[]; };
          (async () => {
            try {
              const isMaster = proto.isMaster;
              const roles = isMaster ? [] : await this._perms(proto);
              const payload = proto.rebind(isMaster ? objects : _.filter(objects, object => {
                const acl = object.acl();
                const clp = proto.schema[object.className].classLevelPermissions?.get ?? ['*'];
                return _.some(roles, x => _.includes(clp, x) && _.includes(acl.read, x));
              }));
              if (!_.isEmpty(payload)) await callback(event, payload);
            } catch (e) {
              proto.logger.error(e);
            }
          })();
        }
      ),
    };
  }

  liveQuery(
    proto: P,
    event: string,
    className: string,
    filter: TQuerySelector[],
    callback: (object: TObject) => void,
  ) {
    const _filter = _.isEmpty(filter) ? true : QuerySelector.decode(filter);
    return this._liveQuery(proto, (ev, objs) => {
      if (event !== ev) return;
      for (const object of objs) {
        if (className !== object.className) continue;
        (async () => {
          try {
            if (_filter === true || _filter.eval(object)) await callback(object);
          } catch (e) {
            proto.logger.error(e);
          }
        })();
      }
    });
  }

  validateCLPs(
    className: string,
    acls: string[],
    keys: (keyof TSchema.CLPs)[],
  ) {
    if (!_.has(this.options.schema, className)) throw Error('No permission');
    const perms = this.options.schema[className].classLevelPermissions ?? {};
    for (const key of keys) {
      if (_.every(perms[key] ?? ['*'], x => !_.includes(acls, x))) return false;
    }
    return true;
  }

  async refs(proto: P, object: TObject, options?: ExtraOptions<boolean>) {
    const roles = options?.master ? [] : await this._perms(proto);
    const classNames = options?.master ? _.keys(this.options.schema) : _.filter(_.keys(this.options.schema), x => this.validateCLPs(x, roles, ['find']));
    const storage = _serviceOf(options)?.storage ?? this.options.storage;
    return storage.refs(object, classNames, options?.master ? undefined : roles);
  }

  async scheduleJob(proto: P, name: string, params: any, options?: ExtraOptions<boolean>) {

    const opt = this.jobs[name];
    if (_.isNil(opt)) throw Error('Job not found');

    const user = await proto.currentUser();

    if (!_.isFunction(opt)) {
      const roles = await proto.currentRoles();
      const { validator } = opt;
      if (!options?.master) {
        if (!!validator?.requireUser && !user) throw Error('No permission');
        if (!!validator?.requireMaster) throw Error('No permission');
        if (_.isArray(validator?.requireAnyUserRoles) && !_.some(validator?.requireAnyUserRoles, x => _.includes(roles, x))) throw Error('No permission');
        if (_.isArray(validator?.requireAllUserRoles) && _.some(validator?.requireAllUserRoles, x => !_.includes(roles, x))) throw Error('No permission');
      }
    }

    const obj = proto.Object('_Job');
    obj.set('name', name);
    obj.set('data', params);
    obj.set('user', user);
    await obj.save({ master: true });

    this.jobRunner.excuteJob(proto);

    return obj;
  }
}

class JobRunner<Ext, P extends ProtoService<Ext>> {

  private _running = false;
  private _stopped = false;

  static TIMEOUT = 1000 * 60 * 5;
  static HEALTH = 1000 * 60;

  shutdown() {
    this._stopped = true;
  }

  private async cleanUpOldJobs(proto: P) {
    await proto.Query('_JobScope').or(
      q => q.lessThan('_updated_at', new Date(Date.now() - JobRunner.TIMEOUT)),
      q => q.notEqualTo('job.completedAt', null),
    ).deleteMany({ master: true });
  }

  private async getAvailableJobs(proto: P) {
    const running = _.map(await proto.Query('_JobScope').find({ master: true }), x => x.get('scope'));
    const availableJobs = _.pickBy(proto[PVK].jobs, opt => {
      return _.isFunction(opt) || _.isEmpty(_.intersection(opt.scopes ?? [], running));
    });
    return _.keys(availableJobs);
  }

  private async getNextJob(proto: P) {
    const availableJobs = await this.getAvailableJobs(proto);
    return await proto.Query('_Job')
      .containedIn('name', availableJobs)
      .or(
        q => q.lessThan('startedAt', new Date(Date.now() - JobRunner.TIMEOUT)),
        q => q.equalTo('startedAt', null),
      )
      .equalTo('completedAt', null)
      .empty('locks')
      .includes('*', 'user')
      .sort({ _created_at: 1 })
      .first({ master: true });
  }

  private async startJob(proto: P, job: TJob, opt: ProtoJobFunction<Ext, any> | ProtoJobFunctionOptions<Ext>) {
    await proto.withTransaction(async (session) => {
      for (const scope of _.isFunction(opt) ? [] : opt.scopes ?? []) {
        const obj = session.Object('_JobScope');
        obj.set('scope', scope);
        obj.set('job', job);
        await obj.save({ master: true });
      }
      job.set('startedAt', new Date());
      await job.save({ master: true, session });
    });
  }

  private async updateJobScope(proto: P, job: TJob) {
    try {
      await proto.Query('_JobScope').equalTo('job', job).updateOne({}, { master: true });
    } catch (e) { }
  }

  private async executeJobFunction(proto: P, job: TJob, opt: ProtoJobFunction<Ext, any> | ProtoJobFunctionOptions<Ext>) {
    const payload = Object.setPrototypeOf({ params: job.data, user: job.user, job }, this);
    const func = _.isFunction(opt) ? opt : opt.callback;
    await func(proxy(payload));
  }

  private async finalizeJob(job: TJob, error: any = null) {
    if (error) job.set('error', _.pick(error, _.uniq(_.flatMap(prototypes(error), x => Object.getOwnPropertyNames(x)))));
    job.set('completedAt', new Date());
    await job.save({ master: true });
  }

  async excuteJob(proto: P) {
    if (this._running || this._stopped) return;
    this._running = true;

    while (!this._stopped) {
      await this.cleanUpOldJobs(proto);

      const job = await this.getNextJob(proto);
      if (!job) break;

      const opt = proto[PVK].jobs[job.name];
      if (_.isNil(opt)) continue;

      try {
        await this.startJob(proto, job, opt);
      } catch (e) {
        continue;
      }

      (async () => {
        const timer = setInterval(() => this.updateJobScope(proto, job), JobRunner.HEALTH);
        try {
          await this.executeJobFunction(proto, job, opt);
          await this.finalizeJob(job);
        } catch (e) {
          await this.finalizeJob(job, e);
        } finally {
          clearInterval(timer);
        }
        this.excuteJob(proto);
      })();
    }

    this._running = false;
  }
}
