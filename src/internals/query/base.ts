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
import { FieldName, PathName, PathNameMap, TQuerySelector } from './types';
import { TValue } from './value';
import { PVK } from '../private';

interface TQueryFilterBaseOptions {
  filter?: TQuerySelector | TQuerySelector[];
  matches?: Record<string, TQueryBaseOptions>;
};

export interface TQueryBaseOptions extends TQueryFilterBaseOptions {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
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

  match<T extends string>(key: FieldName<T>, callback: (query: TQueryBase) => void) {
    const query = new TQueryBase();
    callback(query);
    if (_.isNil(this[PVK].options.matches)) {
      this[PVK].options.matches = { [key]: query[PVK].options };
    } else if (_.isNil(this[PVK].options.matches[key])) {
      this[PVK].options.matches[key] = query[PVK].options;
    } else {
      this[PVK].options.matches[key] = mergeOpts(this[PVK].options.matches[key], query[PVK].options);
    }
    return this;
  }

}

export class TQueryBase extends TQueryFilterBase {

  [PVK]: { options: TQueryBaseOptions; } = { options: {} };

  sort<T extends Record<string, 1 | -1>>(sort: PathNameMap<T>) {
    this[PVK].options.sort = sort;
    return this;
  }

  skip(skip: number) {
    if (!_.isInteger(skip) || skip < 0) throw Error('Invalid skip number');
    this[PVK].options.skip = skip;
    return this;
  }

  limit(limit: number) {
    if (!_.isInteger(limit) || limit < 0) throw Error('Invalid limit number');
    this[PVK].options.limit = limit;
    return this;
  }

}
