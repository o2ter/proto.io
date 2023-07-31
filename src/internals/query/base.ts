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
import { TQuerySelector } from './types';
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

  match(key: string, value: RegExp | string) {
    return this.filter({ [key]: { $pattern: value ?? null } });
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

  every(key: string, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    const filter = { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) };
    return this.filter({ [key]: { $every: filter } });
  }

  contains(key: string, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    const filter = { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) };
    return this.filter({ [key]: { $contains: filter } });
  }

}
