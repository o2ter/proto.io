//
//  index.ts
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
import { InsecureProtoQuery, ProtoQuery } from '../query';
import { ProtoInternal } from './internal';
import { Request } from 'express';
import { ProtoServiceOptions, ProtoServiceKeyOptions } from './types';
import { ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from '../../internals/proto/types';
import { sessionId, sessionIsMaster, session, signUser } from './session';
import { ProtoType, TransactionOptions } from '../../internals/proto';
import { schedule } from '../schedule';
import { TSerializable } from '../../common';
import { PVK } from '../../internals/private';
import { TExtensions } from '../../internals/object/types';
import { TQuery } from '../../internals/query';
import { TUser } from '../../internals/object/user';
import { ExtraOptions } from '../../internals/options';
import { _TValue } from '../../internals/query/value';

export class ProtoService<Ext> extends ProtoType<Ext> {

  [PVK]: ProtoInternal<Ext, this>;
  req?: Request;
  private _storage?: ProtoServiceOptions<Ext>['storage'];
  private _schedule = schedule(this);

  constructor(options: ProtoServiceOptions<Ext> & ProtoServiceKeyOptions) {
    super();
    this[PVK] = new ProtoInternal({
      objectIdSize: 10,
      maxFetchLimit: 1000,
      maxUploadSize: 20 * 1024 * 1024,
      classExtends: {} as TExtensions<Ext>,
      cookieOptions: { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true },
      jwtSignOptions: { expiresIn: '30d' },
      jwtVerifyOptions: {},
      passwordHashOptions: {
        alg: 'scrypt',
        log2n: 14,
        blockSize: 8,
        parallel: 1,
        keySize: 64,
        saltSize: 64,
      },
      ...options,
    });
  }

  async shutdown() {
    this._schedule.destory();
  }

  classes(): string[] {
    return _.keys(this[PVK].options.schema);
  }

  Query<T extends string>(className: T): TQuery<T, Ext, boolean, this> {
    return new ProtoQuery<T, Ext, boolean>(className, this);
  }

  InsecureQuery<T extends string>(className: T): TQuery<T, Ext, true, this> {
    return new InsecureProtoQuery<T, Ext>(className, this);
  }

  get sessionId(): string | undefined {
    return sessionId(this);
  }

  async currentUser() {
    const _session = await session(this);
    return _session?.user;
  }

  async currentRoles() {
    const _session = await session(this);
    return _session?.roles ?? [];
  }

  get isMaster(): boolean {
    return sessionIsMaster(this) === 'valid';
  }

  get isInvalidMasterToken(): boolean {
    return sessionIsMaster(this) === 'invalid';
  }

  connect<R extends Request, T extends object>(
    req: R,
    attrs?: T | ((x: this & { req: R; }) => T)
  ): this & { req: R; } & T {
    const payload = _.create(this, { req });
    return _.assign(payload, _.isFunction(attrs) ? attrs(payload) : attrs)
  }

  async becomeUser(req: Request, user: TUser) {
    if (!user.objectId) throw Error('Invalid user object');
    if (req.res) await signUser(this, req.res, user);
  }

  async logoutUser(req: Request) {
    if (req.res) await signUser(this, req.res, undefined);
  }

  varifyPassword(user: TUser, password: string, options: ExtraOptions<true, this>) {
    return this[PVK].varifyPassword(this, user, password, options);
  }

  setPassword(user: TUser, password: string, options: ExtraOptions<true, this>) {
    return this[PVK].setPassword(this, user, password, options);
  }

  unsetPassword(user: TUser, options: ExtraOptions<true, this>) {
    return this[PVK].unsetPassword(this, user, options);
  }

  get schema(): ProtoServiceOptions<Ext>['schema'] {
    return this[PVK].options.schema;
  }

  get storage(): ProtoServiceOptions<Ext>['storage'] {
    return this._storage ?? this[PVK].options.storage;
  }

  get fileStorage(): ProtoServiceOptions<Ext>['fileStorage'] {
    return this[PVK].options.fileStorage;
  }

  async config(options?: { master?: boolean; }) {
    return this[PVK].config(this, options);
  }
  async setConfig(values: Record<string, _TValue>, options: { master: true; acl?: string[]; }) {
    if (options.master !== true) throw Error('No permission');
    await this[PVK].setConfig(values, options.acl);
  }

  run(name: string, params?: TSerializable, options?: ExtraOptions<boolean, this>) {
    const payload = Object.setPrototypeOf({ params }, this);
    return this[PVK].run(this, name, payload, options);
  }

  define(
    name: string,
    callback: ProtoFunction<Ext>,
    options?: Omit<ProtoFunctionOptions<Ext>, 'callback'>,
  ) {
    this[PVK].functions[name] = options ? { callback, ...options } : callback;
  }

  beforeSave<T extends string>(name: T, callback: ProtoTrigger<T, Ext>) {
    if (!this[PVK].triggers.beforeSave) this[PVK].triggers.beforeSave = {};
    this[PVK].triggers.beforeSave[name] = callback as ProtoTrigger<string, Ext>;
  }
  afterSave<T extends string>(name: T, callback: ProtoTrigger<T, Ext>) {
    if (!this[PVK].triggers.afterSave) this[PVK].triggers.afterSave = {};
    this[PVK].triggers.afterSave[name] = callback as ProtoTrigger<string, Ext>;
  }
  beforeDelete<T extends string>(name: T, callback: ProtoTrigger<T, Ext>) {
    if (!this[PVK].triggers.beforeDelete) this[PVK].triggers.beforeDelete = {};
    this[PVK].triggers.beforeDelete[name] = callback as ProtoTrigger<string, Ext>;
  }
  afterDelete<T extends string>(name: T, callback: ProtoTrigger<T, Ext>) {
    if (!this[PVK].triggers.afterDelete) this[PVK].triggers.afterDelete = {};
    this[PVK].triggers.afterDelete[name] = callback as ProtoTrigger<string, Ext>;
  }
  beforeSaveFile(callback: ProtoTrigger<'File', Ext>) {
    this[PVK].triggers.beforeSaveFile = callback;
  }
  afterSaveFile(callback: ProtoTrigger<'File', Ext>) {
    this[PVK].triggers.afterSaveFile = callback;
  }
  beforeDeleteFile(callback: ProtoTrigger<'File', Ext>) {
    this[PVK].triggers.beforeDeleteFile = callback;
  }
  afterDeleteFile(callback: ProtoTrigger<'File', Ext>) {
    this[PVK].triggers.afterDeleteFile = callback;
  }

  lockTable(className: string | string[], update: boolean) {
    return this.storage.lockTable(className, update);
  }

  withTransaction<T>(
    callback: (connection: ProtoService<Ext>) => PromiseLike<T>,
    options?: TransactionOptions,
  ) {
    return this.storage.withTransaction((storage) => callback(_.create(this, { _storage: storage })), options);
  }
}
