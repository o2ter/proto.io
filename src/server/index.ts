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
import { ProtoQuery } from './query';
import { ProtoInternal } from './internal';
import {
  PVK,
  ProtoType,
  TExtensions,
  TObjectType,
  TQuery,
  TSerializable,
  TUser,
  ExtraOptions,
} from '../internals';
import { TFileStorage } from './filesys';
import { TStorage } from './storage';
import { TSchema } from './schema';
import { CookieOptions, Request } from 'express';
import { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { Awaitable } from '../internals/types';

type Callback<T, R, E> = (request: Proto<E> & T) => Awaitable<R>;
export type ProtoFunction<E> = Callback<{ data: TSerializable; }, TSerializable, E>;
export type ProtoTrigger<T, E> = Callback<{ object: TObjectType<T, E>; context: TSerializable; }, void, E>;

type Validator = {
  requireUser?: boolean;
  requireMaster?: boolean;
  requireAnyUserRoles?: string[];
  requireAllUserRoles?: string[];
};

export type ProtoFunctionOptions<E> = {
  callback: ProtoFunction<E>;
  validator?: Validator;
};

export type ProtoOptions<Ext> = {
  endpoint: string;
  schema: Record<string, TSchema>;
  storage: TStorage;
  fileStorage: TFileStorage;
  classExtends?: TExtensions<Ext>;
  objectIdSize?: number;
  maxUploadSize?: number | ((proto: Proto<Ext>) => Awaitable<number>);
  cookieOptions?: CookieOptions;
  jwtSignOptions?: SignOptions;
  jwtVerifyOptions?: VerifyOptions;
};

export type ProtoKeyOptions = {
  masterUsers?: { user: string; pass: string; }[];
};

export class Proto<Ext> extends ProtoType<Ext> {

  [PVK]: ProtoInternal<Ext>;

  constructor(options: ProtoOptions<Ext> & ProtoKeyOptions) {
    super();
    this[PVK] = new ProtoInternal(this, {
      objectIdSize: 10,
      maxUploadSize: 20 * 1024 * 1024,
      classExtends: {} as TExtensions<Ext>,
      cookieOptions: { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true },
      jwtSignOptions: { expiresIn: '30d' },
      jwtVerifyOptions: {},
      ...options,
    });
  }

  classes(): string[] {
    return _.keys(this[PVK].options.schema);
  }

  Query<T extends string>(className: T, options?: ExtraOptions): TQuery<T, Ext> {
    return new ProtoQuery<T, Ext>(className, this, options);
  }

  get req(): Request | undefined {
    return undefined
  }

  get user(): TUser | undefined {
    if (this.req && 'user' in this.req) return this.req.user as TUser;
    return undefined;
  }

  get roles(): string[] {
    if (this.req && 'roles' in this.req) return this.req.roles as string[] ?? [];
    return [];
  }

  get isMaster(): boolean {
    if (this.req && 'isMaster' in this.req) return !!this.req.isMaster;
    return false;
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
