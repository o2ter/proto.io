//
//  query.ts
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
import { TFilterQuery } from './filter';
import { TObject, UpdateOperation } from './object';
import { PVK } from './private';
import { TMethods } from './object/types';

export namespace TQuery {
  export interface Options {
    filter?: TFilterQuery<any> | TFilterQuery<any>[];
    sort?: Record<string, 1 | -1>;
    includes?: string[];
    skip?: number;
    limit?: number;
    returning?: 'old' | 'new';
  }
}

export interface TQuery<Ext, C extends string> {
  count: () => PromiseLike<number>;
  then: Promise<(TObject & TMethods<Ext, C>)[]>['then'];
  [Symbol.asyncIterator]: () => AsyncIterator<TObject & TMethods<Ext, C>>;
  insert: (attrs: any) => PromiseLike<(TObject & TMethods<Ext, C>) | undefined>;
  findOneAndUpdate: (update: Record<string, [UpdateOperation, any]>) => PromiseLike<(TObject & TMethods<Ext, C>) | undefined>;
  findOneAndUpsert: (update: Record<string, [UpdateOperation, any]>, setOnInsert: Record<string, any>) => PromiseLike<(TObject & TMethods<Ext, C>) | undefined>;
  findOneAndDelete: () => PromiseLike<(TObject & TMethods<Ext, C>) | undefined>;
  findAndDelete: () => PromiseLike<number>;
}

export class TQuery<Ext, C extends string> {

  [PVK]: {
    className: C;
    options: TQuery.Options;
  }

  constructor(className: C, options: TQuery.Options = {}) {
    this[PVK] = {
      className,
      options,
    };
  }

  get className(): C {
    return this[PVK].className;
  }

  clone() {
    return new TQuery<Ext, C>(this.className, this[PVK].options);
  }

  filter<T>(filter: TFilterQuery<T>) {
    this[PVK].options.filter = this[PVK].options.filter ? [..._.castArray(this[PVK].options.filter), filter] : filter;
    return this;
  }

  sort(sort: Record<string, 1 | -1>) {
    this[PVK].options.sort = sort;
    return this;
  }

  includes(...includes: string[]) {
    this[PVK].options.includes = this[PVK].options.includes ? [...this[PVK].options.includes, ...includes] : includes;
    return this;
  }

  skip(skip: number) {
    this[PVK].options.skip = skip;
    return this;
  }

  limit(limit: number) {
    this[PVK].options.limit = limit;
    return this;
  }

  returning(returning: 'old' | 'new') {
    this[PVK].options.returning = returning;
    return this;
  }

  async get(id: string) {
    const query = new TQuery(this.className);
    return _.first(await query.filter({ _id: id }).limit(1));
  }

  async first() {
    return _.first(await this.clone().limit(1));
  }

  async exists() {
    return !_.isNil(await this.first());
  }

  async updateOne(update: Record<string, [UpdateOperation, any]>) {
    return this.findOneAndUpdate(update);
  }

  async upsertOne(update: Record<string, [UpdateOperation, any]>, setOnInsert: Record<string, any>) {
    return this.findOneAndUpsert(update, setOnInsert);
  }

  async deleteOne() {
    return this.findOneAndDelete();
  }

  async deleteAll() {
    return this.findAndDelete();
  }
}
