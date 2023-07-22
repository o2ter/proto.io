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
import { TSerializable } from '../codec';
import { TStorage } from '../types/storage';
import { TSchema } from '../types/schema';
import { TQuery } from '../types/query';
import { TObject } from '../types/object';
import { TExtensions, TObjectType, TObjectTypes } from '../types/object/types';
import { queryMethods } from './query';
import { objectMethods } from '../types/object/methods';
import { TUser } from '../types/object/user';
import { PVK } from '../types/private';
import { ExtraOptions } from '../types/options';
import { isObjKey } from '../utils';
import { defaultSchema } from './defaults';
import { ProtoType } from '../types/proto';
import { FileData } from '../types/object/file';

type Callback<T, R, E> = (request: Proto<E> & T) => R | PromiseLike<R>;
type ProtoFunction<E> = Callback<{ data: TSerializable; }, TSerializable, E>;
type ProtoTrigger<E> = Callback<{ object: TObject; context: object; }, void, E>;

type Validator = {
  requireUser?: boolean;
  requireMaster?: boolean;
  requireAnyUserRoles?: string[];
  requireAllUserRoles?: string[];
};

type ProtoFunctionOptions<E> = {
  callback: ProtoFunction<E>;
  validator?: Validator;
};

export type ProtoOptions<Ext> = {
  schema: Record<string, TSchema>;
  storage: TStorage;
  classExtends?: TExtensions<Ext>;
  functions?: Record<string, ProtoFunction<Ext> | ProtoFunctionOptions<Ext>>;
  triggers?: {
    beforeSave?: Record<string, ProtoTrigger<Ext>>;
    afterSave?: Record<string, ProtoTrigger<Ext>>;
    beforeDelete?: Record<string, ProtoTrigger<Ext>>;
    afterDelete?: Record<string, ProtoTrigger<Ext>>;
  },
};

export class Proto<Ext> implements ProtoType<Ext> {

  [PVK]: {
    options: ProtoOptions<Ext>;
  };

  constructor(options: ProtoOptions<Ext>) {
    this[PVK] = {
      options,
    };
  }

  classes(): string[] | PromiseLike<string[]> {
    return this.storage.classes();
  }

  Object<T extends string>(className: T): TObjectType<T, Ext> {
    const obj = isObjKey(className, TObjectTypes) ? new TObjectTypes[className] : new TObject(className);
    return objectMethods(obj as TObjectType<T, Ext>, this);
  }

  File(filename: string, data: FileData, type?: string) {
    const file = this.Object('_File');
    file.set('filename', filename);
    file.set('data', data);
    file.set('type', type);
    return file;
  }

  Query<T extends string>(className: T, options?: ExtraOptions): TQuery<T, Ext> {
    return queryMethods(new TQuery<T, Ext>(className), this, options);
  }

  get user(): TUser | undefined {
    return;
  }

  get roles(): string[] {
    return [];
  }

  get schema(): ProtoOptions<Ext>['schema'] {
    return this[PVK].options.schema;
  }

  get storage(): ProtoOptions<Ext>['storage'] {
    return this[PVK].options.storage;
  }

  get functions(): ProtoOptions<Ext>['functions'] {
    return this[PVK].options.functions;
  }

  get triggers(): ProtoOptions<Ext>['triggers'] {
    return this[PVK].options.triggers;
  }

  async _prepare() {
    await this.storage.prepare(_.merge({}, defaultSchema, this.schema));
  }

  async _run(name: string, payload?: any, options?: ExtraOptions) {

    const func = this.functions?.[name];

    if (_.isNil(func)) return null;
    if (_.isFunction(func)) return func(payload ?? this);

    const { callback, validator } = func;

    if (!!validator?.requireUser && !this.user) throw new Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw new Error('No permission');
    if (!_.find(validator?.requireAnyUserRoles, x => _.includes(this.roles, x))) throw new Error('No permission');
    if (_.find(validator?.requireAllUserRoles, x => !_.includes(this.roles, x))) throw new Error('No permission');

    return _.isFunction(callback) ? callback(payload ?? this) : null;
  }

  run(name: string, data?: TSerializable, options?: ExtraOptions) {
    const payload = Object.setPrototypeOf({ data: data ?? null }, this);
    return this._run(name, payload, options);
  }

  define(
    name: string,
    callback: ProtoFunction<Ext>,
    options?: Omit<ProtoFunctionOptions<Ext>, 'callback'>,
  ) {
    if (!this[PVK].options.functions) this[PVK].options.functions = {};
    this[PVK].options.functions[name] = options ? { callback, ...options } : callback;
  }

  beforeSave(name: string, callback: ProtoTrigger<Ext>) {
    if (!this[PVK].options.triggers) this[PVK].options.triggers = {};
    if (!this[PVK].options.triggers.beforeSave) this[PVK].options.triggers.beforeSave = {};
    this[PVK].options.triggers.beforeSave[name] = callback;
  }
  afterSave(name: string, callback: ProtoTrigger<Ext>) {
    if (!this[PVK].options.triggers) this[PVK].options.triggers = {};
    if (!this[PVK].options.triggers.afterSave) this[PVK].options.triggers.afterSave = {};
    this[PVK].options.triggers.afterSave[name] = callback;
  }
  beforeDelete(name: string, callback: ProtoTrigger<Ext>) {
    if (!this[PVK].options.triggers) this[PVK].options.triggers = {};
    if (!this[PVK].options.triggers.beforeDelete) this[PVK].options.triggers.beforeDelete = {};
    this[PVK].options.triggers.beforeDelete[name] = callback;
  }
  afterDelete(name: string, callback: ProtoTrigger<Ext>) {
    if (!this[PVK].options.triggers) this[PVK].options.triggers = {};
    if (!this[PVK].options.triggers.afterDelete) this[PVK].options.triggers.afterDelete = {};
    this[PVK].options.triggers.afterDelete[name] = callback;
  }
}
