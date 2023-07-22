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

import { TSerializable } from '../common/codec';
import { TStorage } from '../common/storage';
import { TSchema } from '../common/schema';
import { TQuery } from '../common/query';
import { TObject } from '../common/object';
import { TExtensions, TObjectType, TObjectTypes } from '../common/object/types';
import { queryMethods } from './query';
import { objectMethods } from '../common/object/methods';
import { TUser } from '../common/object/user';
import { PVK } from '../common/private';
import { ExtraOptions } from '../common/options';
import { isObjKey } from '../common/utils';
import { ProtoType } from '../common/proto';
import { FileData } from '../common/object/file';
import { ProtoInternal } from './internal';

type Callback<T, R, E> = (request: Proto<E> & T) => R | PromiseLike<R>;
export type ProtoFunction<E> = Callback<{ data: TSerializable; }, TSerializable, E>;
export type ProtoTrigger<T, E> = Callback<{ object: TObjectType<T, E>; context: object; }, void, E>;

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
  schema: Record<string, TSchema>;
  storage: TStorage;
  classExtends?: TExtensions<Ext>;
};

export class Proto<Ext> implements ProtoType<Ext> {

  [PVK]: ProtoInternal<Ext>;

  constructor(options: ProtoOptions<Ext>) {
    this[PVK] = new ProtoInternal(this, { ...options });
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
    file.set('type', type);
    file[PVK].extra.data = data;
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
  beforeSaveFile(callback: ProtoTrigger<'_File', Ext>) {
    this[PVK].triggers.beforeSaveFile = callback;
  }
  afterSaveFile(callback: ProtoTrigger<'_File', Ext>) {
    this[PVK].triggers.afterSaveFile = callback;
  }
  beforeDeleteFile(callback: ProtoTrigger<'_File', Ext>) {
    this[PVK].triggers.beforeDeleteFile = callback;
  }
  afterDeleteFile(callback: ProtoTrigger<'_File', Ext>) {
    this[PVK].triggers.afterDeleteFile = callback;
  }
}
