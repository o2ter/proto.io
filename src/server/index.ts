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
import { IOSerializable } from '../codec';
import { IOStorage } from '../types/storage';
import { IOSchema } from '../types/schema';
import { Query } from '../types/query';
import { IOObject } from '../types/object';
import { IOObjectType, IOObjectTypes } from '../types/object/types';
import { queryMethods } from './query';
import { objectMethods } from '../types/object/methods';
import { IOUser } from '../types/object/user';
import { PVK } from '../types/private';
import { ExtraOptions } from '../types/options';
import { isObjKey } from '../utils';

type Callback<T, R> = (request: Proto & T) => R | PromiseLike<R>;
type ProtoFunction = Callback<{ data: IOSerializable; }, IOSerializable>;

type Validator = {
  requireUser?: boolean;
  requireMaster?: boolean;
  requireAnyUserRoles?: string[];
  requireAllUserRoles?: string[];
};

export type ProtoOptions = {
  schema: Record<string, IOSchema>;
  storage: IOStorage;
  functions?: Record<string, ProtoFunction | { callback: ProtoFunction; validator?: Validator }>;
  triggers?: {
    beforeSave?: Record<string, Callback<{ object: IOObject; context: object; }, void>>;
    afterSave?: Record<string, Callback<{ object: IOObject; context: object; }, void>>;
    beforeDelete?: Record<string, Callback<{ object: IOObject; context: object; }, void>>;
    afterDelete?: Record<string, Callback<{ object: IOObject; context: object; }, void>>;
  },
};

export class Proto {

  [PVK]: {
    options: ProtoOptions;
  };

  constructor(options: ProtoOptions) {
    this[PVK] = {
      options,
    };
  }

  classes(): string[] | PromiseLike<string[]> {
    return this.storage.classes();
  }

  object<T extends string>(className: T) {
    const obj = isObjKey(className, IOObjectTypes) ? new IOObjectTypes[className] : new IOObject(className);
    return objectMethods(obj, this) as IOObjectType<T>;
  }

  query(className: string, options?: ExtraOptions): Query {
    return queryMethods(new Query(className), this, options);
  }

  get user(): IOUser | undefined {
    return;
  }

  get roles(): string[] {
    return [];
  }

  get schema(): ProtoOptions['schema'] {
    return this[PVK].options.schema;
  }

  get storage(): ProtoOptions['storage'] {
    return this[PVK].options.storage;
  }

  get functions(): ProtoOptions['functions'] {
    return this[PVK].options.functions;
  }

  get triggers(): ProtoOptions['triggers'] {
    return this[PVK].options.triggers;
  }

  async _prepare() {
    await this.storage.prepare(this.schema);
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

  run(name: string, data?: IOSerializable, options?: ExtraOptions) {
    const payload = Object.setPrototypeOf({ data: data ?? null }, this);
    return this._run(name, payload, options);
  }

}
