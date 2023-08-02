//
//  base.ts
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
import { FieldName, PathName, TQuerySelector } from './types';
import { TValue } from './value';
import { PVK } from '../private';

export class TQueryBase {

  [PVK]: {
    options: {
      filter?: TQuerySelector | TQuerySelector[];
    };
  }

  constructor() {
    this[PVK] = { options: {} };
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

  equalTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $eq: value ?? null } });
  }

  notEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $ne: value ?? null } });
  }

  lessThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lt: value ?? null } });
  }

  greaterThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gt: value ?? null } });
  }

  lessThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lte: value ?? null } });
  }

  greaterThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gte: value ?? null } });
  }

  pattern<T extends string>(key: PathName<T>, value: RegExp | string) {
    return this.filter({ [key]: { $pattern: value ?? null } });
  }

  containsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $in: value ?? null } });
  }

  containsAll<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $all: value } });
  }

  notContainsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $nin: value ?? null } });
  }

  every<T extends string>(key: PathName<T>, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    return this.filter({ [key]: { $every: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  some<T extends string>(key: PathName<T>, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    return this.filter({ [key]: { $some: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  match<T extends string>(key: FieldName<T>, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    return this.filter({ [key]: { $match: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

}
