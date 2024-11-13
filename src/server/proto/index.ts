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
import jwt from 'jsonwebtoken';
import { ProtoQuery, ProtoRelationQuery } from '../query';
import { ProtoInternal } from './internal';
import { CookieOptions, Request } from '@o2ter/server-js';
import { ProtoServiceOptions, ProtoServiceKeyOptions } from './types';
import { ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from '../../internals/proto/types';
import { sessionId, sessionIsMaster, session, signUser, Session, sessionWithToken } from './session';
import { EventData, ProtoType, TransactionOptions } from '../../internals/proto';
import { schedule } from '../schedule';
import { TSerializable } from '../../common';
import { PVK } from '../../internals/private';
import { TExtensions, TObjectType } from '../../internals/object/types';
import { TQuery } from '../../internals/query';
import { TUser } from '../../internals/object/user';
import { ExtraOptions } from '../../internals/options';
import { _TValue } from '../../internals/types';
import { randomUUID } from '@o2ter/crypto-js';
import { TObject } from '../../internals/object';
import { asyncStream } from '@o2ter/utils-js';
import { TRole } from '../../internals/object/role';

export class ProtoService<Ext = any> extends ProtoType<Ext> {

  /** @internal */
  [PVK]: ProtoInternal<Ext, this>;
  private _storage?: ProtoServiceOptions<Ext>['storage'];
  private _schedule = schedule(this);

  req?: Request;
  session?: Session;

  constructor(options: ProtoServiceOptions<Ext> & ProtoServiceKeyOptions) {
    super();
    this[PVK] = new ProtoInternal({
      objectIdSize: 10,
      maxFetchLimit: 1000,
      maxUploadSize: 20 * 1024 * 1024,
      pubsub: {
        publish: () => void 0,
        subscribe: () => () => void 0,
      },
      classExtends: {} as TExtensions<Ext>,
      cookieOptions: { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true },
      jwtSignOptions: { expiresIn: '30d' },
      jwtVerifyOptions: {},
      jwtUploadSignOptions: { expiresIn: '1d' },
      jwtUploadVerifyOptions: {},
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
    this._schedule.destroy();
  }

  classes(): string[] {
    return _.keys(this[PVK].options.schema);
  }

  Query<T extends string>(className: T): TQuery<T, Ext, boolean> {
    return new ProtoQuery<T, Ext, boolean>(className, this, {});
  }

  Relation(object: TObject, key: string): TQuery<string, Ext, boolean> {
    const objectId = object.objectId;
    if (!objectId) throw Error('Invalid object');
    return new ProtoRelationQuery<Ext, boolean>(this, {
      relatedBy: {
        className: object.className,
        objectId,
        key,
      },
    });
  }

  InsecureQuery<T extends string>(className: T): TQuery<T, Ext, true> {
    return new ProtoQuery<T, Ext, true>(className, this, { insecure: true });
  }

  get sessionId(): string | undefined {
    if (this.session) return this.session.sessionId;
    return this.req ? sessionId(this, this.req) : undefined;
  }

  async sessionInfo() {
    if (this.session) return this.session;
    return this.req ? session(this, this.req) : undefined;
  }

  async currentUser(): Promise<TUser | undefined> {
    const session = await this.sessionInfo();
    return session?.user;
  }

  async _currentRoles(): Promise<TRole[]> {
    const session = await this.sessionInfo();
    return session?._roles ?? [];
  }

  async currentRoles(): Promise<string[]> {
    const roles = await this._currentRoles();
    return _.compact(_.map(roles, x => x.name));
  }

  get isMaster(): boolean {
    return this.req ? sessionIsMaster(this, this.req) === 'valid' : false;
  }

  get isInvalidMasterToken(): boolean {
    return this.req ? sessionIsMaster(this, this.req) === 'invalid' : false;
  }

  connect<R extends Request, T extends object>(
    req: R,
    attrs?: T | ((x: this & { req: R; }) => T)
  ): this & { req: R; } & T {
    const payload = _.create(this, { req });
    return _.assign(payload, _.isFunction(attrs) ? attrs(payload) : attrs)
  }

  async connectWithSessionToken<T extends object>(
    token: string,
    attrs?: T | ((x: this & { session?: Session; }) => T)
  ): Promise<this & { session?: Session; } & T> {
    const session = _.isString(token) ? await sessionWithToken(this, token) : undefined;
    const payload = _.create(this, { session });
    return _.assign(payload, _.isFunction(attrs) ? attrs(payload) : attrs)
  }

  async becomeUser(
    req: Request,
    user: TUser,
    options?: {
      cookieOptions?: CookieOptions | undefined;
      jwtSignOptions?: jwt.SignOptions | undefined;
    }
  ) {
    if (!user.objectId) throw Error('Invalid user object');
    if (req.res) await signUser(this, req.res, user, options);
  }

  async logoutUser(
    req: Request,
    options?: {
      cookieOptions?: CookieOptions | undefined;
      jwtSignOptions?: jwt.SignOptions | undefined;
    }
  ) {
    if (req.res) await signUser(this, req.res, undefined, options);
  }

  varifyPassword(user: TUser, password: string, options: ExtraOptions<true>) {
    return this[PVK].varifyPassword(this, user, password, options);
  }

  setPassword(user: TUser, password: string, options: ExtraOptions<true>) {
    return this[PVK].setPassword(this, user, password, options);
  }

  unsetPassword(user: TUser, options: ExtraOptions<true>) {
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
  configAcl(options: { master: true; }) {
    if (options.master !== true) throw Error('No permission');
    return this[PVK].configAcl();
  }
  async setConfig(values: Record<string, _TValue>, options: { master: true; acl?: string[]; }) {
    if (options.master !== true) throw Error('No permission');
    await this[PVK].setConfig(values, options.acl);
  }

  run(name: string, params?: TSerializable, options?: ExtraOptions<boolean>) {
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

  lockTable(className: string | string[], update: boolean) {
    return this.storage.lockTable(className, update);
  }

  withTransaction<T>(
    callback: (connection: ProtoService<Ext>) => PromiseLike<T>,
    options?: TransactionOptions,
  ) {
    return this.storage.withTransaction((storage) => callback(_.create(this, { _storage: storage })), options);
  }

  generateUploadToken(
    options: {
      maxUploadSize?: number;
      jwtSignOptions?: jwt.SignOptions;
    } = {}
  ) {
    return this[PVK].jwtSign({
      nonce: randomUUID(),
      maxUploadSize: options.maxUploadSize,
    }, options?.jwtSignOptions ?? 'upload');
  }

  jwtSign(payload: any, options: jwt.SignOptions) {
    return this[PVK].jwtSign(payload, options);
  }

  jwtVarify(token: string, options: jwt.VerifyOptions = {}) {
    return this[PVK].jwtVarify(token, options);
  }

  notify(data: Record<string, _TValue> & { _rperm?: string[]; }) {
    return this[PVK].notify(this, data);
  }

  listen(callback: (data: EventData) => void) {
    return this[PVK].listen(this, data => {
      callback(data);
    });
  }

  refs(object: TObject, options?: ExtraOptions<boolean>) {
    if (!object.objectId) throw Error('Invalid object');
    const self = this;
    return asyncStream(async function* () {
      const objects = await self[PVK].refs(self, object, options);
      for await (const object of objects) yield self.rebind(object) as TObjectType<string, Ext>;
    });
  }
}
