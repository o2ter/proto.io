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
import { PObject } from './object';
import { Query } from './query';
import { queryMethods } from './query/methods';

export type ProtoFunction = (
  request: Proto & { data: IOSerializable; }
) => IOSerializable | PromiseLike<IOSerializable>;

export type ProtoOptions = {
  schema: Record<string, PSchema>;
  storage: PStorage;
  functions?: Record<string, ProtoFunction>;
};

export class Proto {

  #options: ProtoOptions;

  constructor(options: ProtoOptions) {
    this.#options = options;
  }

  models(): string[] | PromiseLike<string[]> {
    return this.storage.models();
  }

  query(model: string): Query {
    const query = new Query(model);
    queryMethods(query, this.storage, []);
    return query;
  }

  insert(model: string, attrs: any): PromiseLike<PObject | undefined> {
    return this.storage.insert(model, attrs);
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

  async _prepare() {
    await this.storage.prepare(this.schema);
  }

  async run(name: string, data?: IOSerializable) {
    const func = this.#options.functions?.[name];
    const payload = Object.setPrototypeOf({ data: data ?? null }, this);
    return _.isFunction(func) ? func(payload) : null;
  }

}
