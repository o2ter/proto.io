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

/**
 * Options for a query filter.
 */
interface TQueryFilterBaseOptions {
  /**
   * The filter(s) to apply to the query.
   */
  filter?: TQuerySelector | TQuerySelector[];
};

/**
 * Sort option for a query.
 */
export type TSortOption = {
  /**
   * The expression to sort by.
   */
  expr: TExpression;
  /**
   * The order of sorting, 1 for ascending and -1 for descending.
   */
  order: 1 | -1;
};

/**
 * Base options for a query.
 */
export interface TQueryBaseOptions extends TQueryFilterBaseOptions {
  /**
   * The sorting options for the query.
   */
  sort?: Record<string, 1 | -1> | TSortOption[];
  /**
   * The number of results to skip.
   */
  skip?: number;
  /**
   * The limit on the number of results.
   */
  limit?: number;
  /**
   * Nested query options for matching specific fields.
   */
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

/**
 * Base class for query filters.
 */
class TQueryFilterBase {

  /** @internal */
  [PVK]: { options: TQueryFilterBaseOptions; } = { options: {} };

  /**
   * Applies a filter to the query.
   * @param filter - The filter to apply.
   * @returns The current instance for chaining.
   */
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

  /**
   * Applies an equality filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  equalTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $eq: value ?? null } });
  }

  /**
   * Apply not equal filter to query
   * @param key - key to filter
   * @param value - value to filter
   * @returns The current instance for chaining.
   */
  notEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $ne: value ?? null } });
  }

  /**
   * Apply less than filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the less than filter applied.
   */
  lessThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lt: value ?? null } });
  }

  /**
   * Apply greater than filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the greater than filter applied.
   */
  greaterThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gt: value ?? null } });
  }

  /**
   * Apply less than or equal to filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the less than or equal to filter applied.
   */
  lessThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lte: value ?? null } });
  }

  /**
   * Apply greater than or equal to filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the greater than or equal to filter applied.
   */
  greaterThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gte: value ?? null } });
  }

  /**
   * Apply pattern filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The pattern to filter.
   * @returns The query with the pattern filter applied.
   */
  pattern<T extends string>(key: PathName<T>, value: RegExp | string) {
    return this.filter({ [key]: { $pattern: value ?? null } });
  }

  /**
   * Apply starts with filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the starts with filter applied.
   */
  startsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $starts: value ?? null } });
  }

  /**
   * Apply ends with filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the ends with filter applied.
   */
  endsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $ends: value ?? null } });
  }

  /**
   * Apply size filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The query with the size filter applied.
   */
  size<T extends string>(key: PathName<T>, value: number) {
    return this.filter({ [key]: { $size: value } });
  }

  /**
   * Apply empty filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @returns The query with the empty filter applied.
   */
  empty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: true } });
  }

  /**
   * Apply not empty filter to query
   * @template T - The type of the key.
   * @param key - The key to filter.
   * @returns The query with the not empty filter applied.
   */
  notEmpty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: false } });
  }

  /**
   * Filters the query to include only documents where the specified key contains any of the specified values.
   * @param key - The key to check for values.
   * @param value - The array of values to check for.
   * @returns The filtered query.
   */
  containsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $in: value } });
  }

  /**
   * Filters the query to exclude documents where the specified key contains any of the specified values.
   * @param key - The key to check for values.
   * @param value - The array of values to exclude.
   * @returns The filtered query.
   */
  notContainsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $nin: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is a subset of the specified values.
   * @param key - The key to check for subset.
   * @param value - The array of values to check against.
   * @returns The filtered query.
   */
  isSubset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $subset: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is a superset of the specified values.
   * @param key - The key to check for superset.
   * @param value - The array of values to check against.
   * @returns The filtered query.
   */
  isSuperset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $superset: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is disjoint from the specified values.
   * @param key - The key to check for disjoint.
   * @param value - The array of values to check against.
   * @returns The filtered query.
   */
  isDisjoint<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $not: { $intersect: value } } });
  }

  /**
   * Filters the query to include only documents where the specified key intersects with the specified values.
   * @param key - The key to check for intersection.
   * @param value - The array of values to check against.
   * @returns The filtered query.
   */
  isIntersect<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $intersect: value } });
  }

  /**
   * Filters the query to include only documents where every element of the specified key matches the provided callback query.
   * @param key - The key to check for every element.
   * @param callback - The callback query to apply to each element.
   * @returns The filtered query.
   */
  every<T extends string>(key: PathName<T>, callback: (query: TQueryFilterBase) => void) {
    const query = new TQueryFilterBase();
    callback(query);
    return this.filter({ [key]: { $every: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  /**
   * Filters the query to include only documents where some elements of the specified key match the provided callback query.
   * @param key - The key to check for some elements.
   * @param callback - The callback query to apply to each element.
   * @returns The filtered query.
   */
  some<T extends string>(key: PathName<T>, callback: (query: TQueryFilterBase) => void) {
    const query = new TQueryFilterBase();
    callback(query);
    return this.filter({ [key]: { $some: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  /**
   * Filters the query to include only documents that match all of the provided callback queries.
   * @param callbacks - The callback queries to apply.
   * @returns The filtered query.
   */
  and(...callbacks: _.Many<(query: TQueryFilterBase) => void>[]) {
    return this.filter({
      $and: _.flatMap(_.flatten(callbacks), callback => {
        const query = new TQueryFilterBase();
        callback(query);
        return _.castArray<TQuerySelector>(query[PVK].options.filter);
      }),
    });
  }

  /**
   * Filters the query to include only documents that match any of the provided callback queries.
   * @param callbacks - The callback queries to apply.
   * @returns The filtered query.
   */
  or(...callbacks: _.Many<(query: TQueryFilterBase) => void>[]) {
    return this.filter({
      $or: _.map(_.flatten(callbacks), callback => {
        const query = new TQueryFilterBase();
        callback(query);
        return {
          $and: _.castArray<TQuerySelector>(query[PVK].options.filter),
        };
      }),
    });
  }

  /**
   * Filters the query to include only documents that do not match any of the provided callback queries.
   * @param callbacks - The callback queries to apply.
   * @returns The filtered query.
   */
  nor(...callbacks: _.Many<(query: TQueryFilterBase) => void>[]) {
    return this.filter({
      $nor: _.map(_.flatten(callbacks), callback => {
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

  /**
   * Sorts the query results.
   * @param sort - The sorting criteria.
   * @returns The query with the sorting applied.
   */
  sort<T extends Record<string, 1 | -1>>(sort: PathNameMap<T> | TSortOption[]) {
    this[PVK].options.sort = sort;
    return this;
  }

  /**
   * Skips the specified number of results.
   * @param skip - The number of results to skip.
   * @returns The query with the skip applied.
   */
  skip(skip: number) {
    if (!_.isSafeInteger(skip) || skip < 0) throw Error('Invalid skip number');
    this[PVK].options.skip = skip;
    return this;
  }

  /**
   * Limits the number of results.
   * @param limit - The maximum number of results to return.
   * @returns The query with the limit applied.
   */
  limit(limit: number) {
    if (!_.isSafeInteger(limit) || limit < 0) throw Error('Invalid limit number');
    this[PVK].options.limit = limit;
    return this;
  }

  /**
   * Performs a nested query on a specific key.
   * @param key - The key to match.
   * @param callback - The callback function to execute.
   * @returns The query with the match applied.
   */
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
