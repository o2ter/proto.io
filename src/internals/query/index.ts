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
import { TQuerySelector } from './types';
import { TValue } from './value';
import { UpdateOp } from '../object';
import { PVK } from '../private';
import { TObjectType } from '../object/types';

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

export interface TQuery<T extends string, Ext> {
  explain(): PromiseLike<any>;
  count(): PromiseLike<number>;
  find(): PromiseLike<TObjectType<T, Ext>[]> & AsyncIterable<TObjectType<T, Ext>>;
  insert(attrs: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  findOneAndUpdate(update: Record<string, [UpdateOp, TValue]>): PromiseLike<TObjectType<T, Ext> | undefined>;
  findOneAndReplace(replacement: Record<string, TValue>): PromiseLike<TObjectType<T, Ext> | undefined>;
  findOneAndUpsert(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  findOneAndDelete(): PromiseLike<TObjectType<T, Ext> | undefined>;
  findAndDelete(): PromiseLike<number>;
}

export class TQuery<T extends string, Ext> {

  [PVK]: {
    className: T;
    options: TQuery.Options;
  }

  constructor(className: T, options: TQuery.Options = {}) {
    this[PVK] = {
      className,
      options,
    };
  }

  get className(): T {
    return this[PVK].className;
  }

  clone() {
    return new TQuery<T, Ext>(this.className, { ...this[PVK].options });
  }

  filter(filter: TQuerySelector) {
    if (_.isNil(this[PVK].options.filter)) {
      this[PVK].options.filter = filter;
    } else if (_.isArray(this[PVK].options.filter)) {
      this[PVK].options.filter = [...this[PVK].options.filter, filter];
    } else {
      this[PVK].options.filter = [this[PVK].options.filter, filter];
    }
    return this;
  }

  equalTo(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $eq: value ?? null } });
  }

  notEqualTo(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $ne: value ?? null } });
  }

  lessThan(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $lt: value ?? null } });
  }

  greaterThan(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $gt: value ?? null } });
  }

  lessThanOrEqualTo(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $lte: value ?? null } });
  }

  greaterThanOrEqualTo(key: string, value: TValue | undefined) {
    return this.filter({ [key]: { $gte: value ?? null } });
  }

  contains(key: string, value: RegExp | string) {
    return this.filter({ [key]: { $search: value ?? null } });
  }

  containsIn(key: string, value: TValue[]) {
    return this.filter({ [key]: { $in: value ?? null } });
  }

  containsAll(key: string, value: TValue[]) {
    return this.filter({ [key]: { $all: value } });
  }

  notContainsIn(key: string, value: TValue[]) {
    return this.filter({ [key]: { $nin: value ?? null } });
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
