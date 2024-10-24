//
//  base.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { PathName, PathNameMap } from './types';
import { TQuerySelector } from './types/selectors';
import { TValue } from '../types';
import { PVK } from '../private';
import { TExpression } from './types/expressions';

interface TQueryFilterBaseOptions {
  filter?: TQuerySelector | TQuerySelector[];
};

export type TSortOption = {
  expr: TExpression;
  order: 1 | -1;
};

export interface TQueryBaseOptions extends TQueryFilterBaseOptions {
  sort?: Record<string, 1 | -1> | TSortOption[];
  skip?: number;
  limit?: number;
  matches?: Record<string, TQueryBaseOptions>;
};

const mergeOpts = (lhs: TQueryBaseOptions, rhs: TQueryBaseOptions): TQueryBaseOptions => {
  return {
    ...lhs,
    ...rhs,
    filter: [
      ..._.castArray<TQuerySelector>(lhs.filter),
      ..._.castArray<TQuerySelector>(rhs.filter)
    ],
    matches: {
      ...lhs.matches,
      ..._.mapValues(rhs.matches, (opts, key) => lhs.matches?.[key] ? mergeOpts(lhs.matches[key], opts) : opts),
    },
  };
}

class TQueryFilterBase {

  /** @internal */
  [PVK]: { options: TQueryFilterBaseOptions; } = { options: {} };

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

  startsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $starts: value ?? null } });
  }

  endsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $ends: value ?? null } });
  }

  size<T extends string>(key: PathName<T>, value: number) {
    return this.filter({ [key]: { $size: value } });
  }

  empty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: true } });
  }

  notEmpty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: false } });
  }

  containsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $in: value } });
  }

  notContainsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $nin: value } });
  }

  isSubset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $subset: value } });
  }

  isSuperset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $superset: value } });
  }

  isDisjoint<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $disjoint: value } });
  }

  isIntersect<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $intersect: value } });
  }

  every<T extends string>(key: PathName<T>, callback: (query: TQueryFilterBase) => void) {
    const query = new TQueryFilterBase();
    callback(query);
    return this.filter({ [key]: { $every: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  some<T extends string>(key: PathName<T>, callback: (query: TQueryFilterBase) => void) {
    const query = new TQueryFilterBase();
    callback(query);
    return this.filter({ [key]: { $some: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  and(...callbacks: ((query: TQueryFilterBase) => void)[]) {
    return this.filter({
      $and: _.flatMap(callbacks, callback => {
        const query = new TQueryFilterBase();
        callback(query);
        return _.castArray<TQuerySelector>(query[PVK].options.filter);
      }),
    });
  }

  or(...callbacks: ((query: TQueryFilterBase) => void)[]) {
    return this.filter({
      $or: _.map(callbacks, callback => {
        const query = new TQueryFilterBase();
        callback(query);
        return {
          $and: _.castArray<TQuerySelector>(query[PVK].options.filter),
        };
      }),
    });
  }

  nor(...callbacks: ((query: TQueryFilterBase) => void)[]) {
    return this.filter({
      $nor: _.map(callbacks, callback => {
        const query = new TQueryFilterBase();
        callback(query);
        return {
          $and: _.castArray<TQuerySelector>(query[PVK].options.filter),
        };
      }),
    });
  }
}

export class TQueryBase extends TQueryFilterBase {

  /** @internal */
  [PVK]: { options: TQueryBaseOptions; } = { options: {} };

  sort<T extends Record<string, 1 | -1>>(sort: PathNameMap<T> | TSortOption[]) {
    this[PVK].options.sort = sort;
    return this;
  }

  skip(skip: number) {
    if (!_.isSafeInteger(skip) || skip < 0) throw Error('Invalid skip number');
    this[PVK].options.skip = skip;
    return this;
  }

  limit(limit: number) {
    if (!_.isSafeInteger(limit) || limit < 0) throw Error('Invalid limit number');
    this[PVK].options.limit = limit;
    return this;
  }

  match<T extends string>(key: PathName<T>, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    if (_.isNil(this[PVK].options.matches)) {
      this[PVK].options.matches = { [key]: query[PVK].options };
    } else if (_.isNil(this[PVK].options.matches[key])) {
      this[PVK].options.matches = { ...this[PVK].options.matches };
      this[PVK].options.matches[key] = query[PVK].options;
    } else {
      this[PVK].options.matches = { ...this[PVK].options.matches };
      this[PVK].options.matches[key] = mergeOpts(this[PVK].options.matches[key], query[PVK].options);
    }
    return this;
  }
}
