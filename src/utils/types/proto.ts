//
//  proto.ts
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
import { PStorage } from './storage';
import { PSchema } from './schema';
import { Query } from './query';
import { PObject } from './object';
import { queryMethods } from './query/methods';

type Callback<T, R> = (request: Proto & T) => R | PromiseLike<R>;
type ProtoFunction = Callback<{ data: IOSerializable; }, IOSerializable>;

type Validator = {
  requireUser?: boolean;
  requireMaster?: boolean;
  requireAnyUserRoles?: string[];
  requireAllUserRoles?: string[];
};

export type ProtoOptions = {
  schema: Record<string, PSchema>;
  storage: PStorage;
  functions?: Record<string, ProtoFunction | { callback: ProtoFunction; validator?: Validator }>;
  triggers?: {
    beforeSave?: Record<string, Callback<{ object: PObject; }, void>>;
    afterSave?: Record<string, Callback<{ object: PObject; }, void>>;
    beforeDelete?: Record<string, Callback<{ object: PObject; }, void>>;
    afterDelete?: Record<string, Callback<{ object: PObject; }, void>>;
  },
};

export class Proto {

  #options: ProtoOptions;

  constructor(options: ProtoOptions) {
    this.#options = options;
  }

  models(): string[] | PromiseLike<string[]> {
    return this.storage.models();
  }

  query(model: string, master?: boolean): Query {
    return queryMethods(new Query(model), this, master ?? false);
  }

  roles(): string[] {
    return []
  }

  get schema(): ProtoOptions['schema'] {
    return this.#options.schema;
  }

  get storage(): ProtoOptions['storage'] {
    return this.#options.storage;
  }

  get functions(): ProtoOptions['functions'] {
    return this.#options.functions;
  }

  get triggers(): ProtoOptions['triggers'] {
    return this.#options.triggers;
  }

  async _prepare() {
    await this.storage.prepare(this.schema);
  }

  async run(name: string, data?: IOSerializable, master?: boolean) {

    const func = this.#options.functions?.[name];
    const payload = Object.setPrototypeOf({ data: data ?? null }, this);

    if (_.isFunction(func)) return func(payload);

    const { callback, validator } = func ?? {};

    if (!!validator?.requireMaster && !master) throw new Error('No permission');

    return _.isFunction(callback) ? callback(payload) : null;
  }

}
