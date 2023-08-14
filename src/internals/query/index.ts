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
import { IncludePaths } from './types';
import { TValue } from './value';
import { PVK } from '../private';
import { TObjectType } from '../object/types';
import { asyncStream } from '../utils';
import { TQueryBase, TQueryBaseOptions } from './base';
import { TUpdateOp } from '../object/types';

export interface TQueryOptions extends TQueryBaseOptions {
  includes?: string[];
};

export abstract class TQuery<T extends string, Ext> extends TQueryBase {

  [PVK]: {
    className: T;
    options: TQueryOptions;
  }

  constructor(className: T, options: TQueryOptions = {}) {
    super();
    this[PVK] = {
      className,
      options,
    };
  }

  get className(): T {
    return this[PVK].className;
  }

  abstract clone(options?: TQueryOptions): TQuery<T, Ext>;
  abstract explain(): PromiseLike<any>;
  abstract count(): PromiseLike<number>;
  abstract find(): ReturnType<typeof asyncStream<TObjectType<T, Ext>>>;
  abstract insert(attrs: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  abstract updateOne(update: Record<string, TUpdateOp>): PromiseLike<TObjectType<T, Ext> | undefined>;
  abstract upsertOne(update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValue>): PromiseLike<TObjectType<T, Ext>>;
  abstract deleteOne(): PromiseLike<TObjectType<T, Ext> | undefined>;
  abstract deleteMany(): PromiseLike<number>;

  includes<T extends string[]>(...includes: IncludePaths<T>) {
    this[PVK].options.includes = this[PVK].options.includes ? [...this[PVK].options.includes, ...includes] : includes;
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

}
