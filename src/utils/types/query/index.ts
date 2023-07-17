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
import { FilterQuery } from './filter';
import { IOObject, UpdateOperation } from '../object';
import { privateKey } from '../private';

export namespace Query {
  export interface Options {
    filter?: FilterQuery<any> | FilterQuery<any>[];
    sort?: Record<string, 1 | -1>;
    includes?: string[];
    skip?: number;
    limit?: number;
    returning?: 'old' | 'new';
  }
}

export interface Query {
  count: () => PromiseLike<number>;
  then: Promise<IOObject[]>['then'];
  [Symbol.asyncIterator]: () => AsyncIterator<IOObject>;
  insert: (attrs: any) => PromiseLike<IOObject | undefined>;
  findOneAndUpdate: (update: Record<string, [UpdateOperation, any]>) => PromiseLike<IOObject | undefined>;
  findOneAndUpsert: (update: Record<string, [UpdateOperation, any]>, setOnInsert: Record<string, any>) => PromiseLike<IOObject | undefined>;
  findOneAndDelete: () => PromiseLike<IOObject | undefined>;
  findAndDelete: () => PromiseLike<IOObject | undefined>;
}

export class Query {

  [privateKey]: {
    className: string;
    options: Query.Options;
  }

  constructor(className: string, options: Query.Options = {}) {
    this[privateKey] = {
      className,
      options,
    };
  }

  get className(): string {
    return this[privateKey].className;
  }

  filter<T>(filter: FilterQuery<T>) {
    this[privateKey].options.filter = this[privateKey].options.filter ? [..._.castArray(this[privateKey].options.filter), filter] : filter;
    return this;
  }

  sort(sort: Record<string, 1 | -1>) {
    this[privateKey].options.sort = sort;
    return this;
  }

  includes(...includes: string[]) {
    this[privateKey].options.includes = this[privateKey].options.includes ? [...this[privateKey].options.includes, ...includes] : includes;
    return this;
  }

  skip(skip: number) {
    this[privateKey].options.skip = skip;
    return this;
  }

  limit(limit: number) {
    this[privateKey].options.limit = limit;
    return this;
  }

  returning(returning: 'old' | 'new') {
    this[privateKey].options.returning = returning;
    return this;
  }

}
