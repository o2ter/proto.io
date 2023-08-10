//
//  index.ts
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
import { InsecureProtoQuery, ProtoQuery } from '../query';
import { ProtoInternal } from './internal';
import {
  PVK,
  ProtoType,
  TExtensions,
  TQuery,
  TSerializable,
  TUser,
  ExtraOptions,
} from '../../internals';
import { Request } from 'express';
import { signUser } from '../auth/sign';
import { ProtoOptions, ProtoKeyOptions, ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from './types';
import { sessionId, sessionIsMaster, session } from './session';

export class Proto<Ext> extends ProtoType<Ext> {

  [PVK]: ProtoInternal<Ext>;
  req?: Request;

  constructor(options: ProtoOptions<Ext> & ProtoKeyOptions) {
    super();
    this[PVK] = new ProtoInternal(this, {
      objectIdSize: 10,
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

  classes(): string[] {
    return _.keys(this[PVK].options.schema);
  }

  Query<T extends string>(className: T, options?: ExtraOptions): TQuery<T, Ext> {
    return new ProtoQuery<T, Ext>(className, this, options);
  }

  InsecureQuery<T extends string>(className: T, options: ExtraOptions & { master: true }): TQuery<T, Ext> {
    return new InsecureProtoQuery<T, Ext>(className, this, options);
  }

  get sessionId(): string | undefined {
    if (this.req && 'sessionId' in this.req) return this.req.sessionId as string;
    return sessionId(this);
  }

  async user() {
    if (this.req && 'user' in this.req) return this.req.user as TUser;
    return (await session(this))?.user;
  }

  async roles() {
    if (this.req && 'roles' in this.req) return this.req.roles as string[] ?? [];
    return (await session(this))?.roles ?? [];
  }

  get isMaster(): boolean {
    return sessionIsMaster(this);
  }

  connect<R extends Request, T extends object>(
    req: R,
    attrs?: T | ((x: this & { req: R; }) => T)
  ): this & { req: R; } & T {
    const payload = _.create(this, { req });
    return _.assign(payload, _.isFunction(attrs) ? attrs(payload) : attrs)
  }

  becomeUser(req: Request, user: TUser) {
    if (!user.objectId) throw Error('Invalid user object');
    if (req.res) signUser(this, req.res, user);
  }

  logoutUser(req: Request) {
    if (req.res) signUser(this, req.res, undefined);
  }

  async varifyPassword(user: TUser, password: string) {
    return this[PVK].varifyPassword(user, password);
  }

  setPassword(user: TUser, password: string) {
    return this[PVK].setPassword(user, password);
  }

  get schema(): ProtoOptions<Ext>['schema'] {
    return this[PVK].options.schema;
  }

  get storage(): ProtoOptions<Ext>['storage'] {
    return this[PVK].options.storage;
  }

  get fileStorage(): ProtoOptions<Ext>['fileStorage'] {
    return this[PVK].options.fileStorage;
  }

  run(name: string, data?: TSerializable, options?: ExtraOptions) {
    const payload = Object.setPrototypeOf({ data: data ?? null }, this);
    return this[PVK].run(name, payload, options);
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
}
