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
import { IncludePaths, TQuerySelector } from './types';
import { TValue } from './value';
import { UpdateOp } from '../object';
import { PVK } from '../private';
import { TObjectType } from '../object/types';
import { asyncStream } from '../utils';
import { TQueryBase } from './base';

export namespace TQuery {
  export interface Options {
    filter?: TQuerySelector | TQuerySelector[];
    sort?: Record<string, 1 | -1>;
    includes?: string[];
    skip?: number;
    limit?: number;
    returning?: 'old' | 'new';
  }
}

export abstract class TQuery<T extends string, Ext> extends TQueryBase {

  [PVK]: {
    className: T;
    options: TQuery.Options;
  }

  constructor(className: T, options: TQuery.Options = {}) {
    super();
    this[PVK] = {
      className,
      options,
    };
  }

  get className(): T {
    return this[PVK].className;
  }

  abstract clone(options?: TQuery.Options): TQuery<T, Ext>;
  abstract explain(): PromiseLike<any>;
  abstract count(): PromiseLike<number>;
  abstract find(): ReturnType<typeof asyncStream<TObjectType<T, Ext>>>;
  abstract insert(attrs: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  abstract findOneAndUpdate(update: Record<string, [UpdateOp, TValue]>): PromiseLike<TObjectType<T, Ext> | undefined>;
  abstract findOneAndReplace(replacement: Record<string, TValue>): PromiseLike<TObjectType<T, Ext> | undefined>;
  abstract findOneAndUpsert(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  abstract findOneAndDelete(): PromiseLike<TObjectType<T, Ext> | undefined>;
  abstract findAndDelete(): PromiseLike<number>;

  sort(sort: Record<string, 1 | -1>) {
    this[PVK].options.sort = sort;
    return this;
  }

  includes<T extends string[]>(...includes: IncludePaths<T>) {
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
    const query = this.clone({});
    if (this[PVK].options.includes) query.includes(...this[PVK].options.includes);
    return _.first(await query.equalTo('_id', id).limit(1).find());
  }

  async first() {
    return _.first(await this.clone().limit(1).find());
  }

  async exists() {
    const query = this.clone();
    this[PVK].options.includes = [];
    return !_.isNil(await query.limit(1).find());
  }

  async updateOne(update: Record<string, [UpdateOp, TValue]>) {
    return this.findOneAndUpdate(update);
  }

  async replaceOne(replacement: Record<string, TValue>) {
    return this.findOneAndReplace(replacement);
  }

  async upsertOne(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return this.findOneAndUpsert(update, setOnInsert);
  }

  async deleteOne() {
    return this.findOneAndDelete();
  }

  async deleteAll() {
    return this.findAndDelete();
  }
}
