//
//  base.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { PathName, PathNameMap, PathNames } from './types';
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
  /**
   * Specifies which relations should only return the count.
   */
  countMatches?: string[];
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
    countMatches: [
      ...lhs.countMatches ?? [],
      ...rhs.countMatches ?? [],
    ],
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
   * Applies a not equal filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  notEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $ne: value ?? null } });
  }

  /**
   * Applies a less than filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  lessThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lt: value ?? null } });
  }

  /**
   * Applies a greater than filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  greaterThan<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gt: value ?? null } });
  }

  /**
   * Applies a less than or equal to filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  lessThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $lte: value ?? null } });
  }

  /**
   * Applies a greater than or equal to filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  greaterThanOrEqualTo<T extends string>(key: PathName<T>, value: TValue | undefined) {
    return this.filter({ [key]: { $gte: value ?? null } });
  }

  /**
   * Applies a pattern filter to the query.
   * @param key - The key to filter.
   * @param value - The pattern to filter.
   * @returns The current instance for chaining.
   */
  pattern<T extends string>(key: PathName<T>, value: RegExp | string) {
    return this.filter({ [key]: { $pattern: value ?? null } });
  }

  /**
   * Applies a starts with filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  startsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $starts: value ?? null } });
  }

  /**
   * Applies an ends with filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  endsWith<T extends string>(key: PathName<T>, value: string) {
    return this.filter({ [key]: { $ends: value ?? null } });
  }

  /**
   * Applies a size filter to the query.
   * @param key - The key to filter.
   * @param value - The value to filter.
   * @returns The current instance for chaining.
   */
  size<T extends string>(key: PathName<T>, value: number) {
    return this.filter({ [key]: { $size: value } });
  }

  /**
   * Applies an empty filter to the query.
   * @param key - The key to filter.
   * @returns The current instance for chaining.
   */
  empty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: true } });
  }

  /**
   * Applies a not empty filter to the query.
   * @param key - The key to filter.
   * @returns The current instance for chaining.
   */
  notEmpty<T extends string>(key: PathName<T>) {
    return this.filter({ [key]: { $empty: false } });
  }

  /**
   * Filters the query to include only documents where the specified key contains any of the specified values.
   * @param key - The key to check for values.
   * @param value - The array of values to check for.
   * @returns The current instance for chaining.
   */
  containsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $in: value } });
  }

  /**
   * Filters the query to exclude documents where the specified key contains any of the specified values.
   * @param key - The key to check for values.
   * @param value - The array of values to exclude.
   * @returns The current instance for chaining.
   */
  notContainsIn<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $nin: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is a subset of the specified values.
   * @param key - The key to check for subset.
   * @param value - The array of values to check against.
   * @returns The current instance for chaining.
   */
  isSubset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $subset: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is a superset of the specified values.
   * @param key - The key to check for superset.
   * @param value - The array of values to check against.
   * @returns The current instance for chaining.
   */
  isSuperset<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $superset: value } });
  }

  /**
   * Filters the query to include only documents where the specified key is disjoint from the specified values.
   * @param key - The key to check for disjoint.
   * @param value - The array of values to check against.
   * @returns The current instance for chaining.
   */
  isDisjoint<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $not: { $intersect: value } } });
  }

  /**
   * Filters the query to include only documents where the specified key intersects with the specified values.
   * @param key - The key to check for intersection.
   * @param value - The array of values to check against.
   * @returns The current instance for chaining.
   */
  isIntersect<T extends string>(key: PathName<T>, value: TValue[]) {
    return this.filter({ [key]: { $intersect: value } });
  }

  /**
   * Filters the query to include only documents where every element of the specified key matches the provided callback query.
   * @param key - The key to check for every element.
   * @param callback - The callback query to apply to each element.
   * @returns The current instance for chaining.
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
   * @returns The current instance for chaining.
   */
  some<T extends string>(key: PathName<T>, callback: (query: TQueryFilterBase) => void) {
    const query = new TQueryFilterBase();
    callback(query);
    return this.filter({ [key]: { $some: { $and: _.castArray<TQuerySelector>(query[PVK].options.filter) } } });
  }

  /**
   * Filters the query to include only documents that match all of the provided callback queries.
   * @param callbacks - The callback queries to apply.
   * @returns The current instance for chaining.
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
   * @returns The current instance for chaining.
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
   * @returns The current instance for chaining.
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
   * @returns The current instance for chaining.
   */
  sort<T extends Record<string, 1 | -1>>(sort: PathNameMap<T> | TSortOption[]) {
    this[PVK].options.sort = sort;
    return this;
  }

  /**
   * Skips the specified number of results.
   * @param skip - The number of results to skip.
   * @returns The current instance for chaining.
   */
  skip(skip: number) {
    if (!_.isSafeInteger(skip) || skip < 0) throw Error('Invalid skip number');
    this[PVK].options.skip = skip;
    return this;
  }

  /**
   * Limits the number of results.
   * @param limit - The maximum number of results to return.
   * @returns The current instance for chaining.
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
   * @returns The current instance for chaining.
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

  /**
   * Adds the specified relations to the count-only options for a nested query.
   * This method is used to specify that only the count of the nested relations should be retrieved.
   * @param relations - The keys of the nested relations to be counted.
   * @returns The current instance for chaining.
   */
  countMatches<T extends string[]>(...relations: PathNames<T>) {
    this[PVK].options.countMatches = this[PVK].options.countMatches ? [...this[PVK].options.countMatches, ...relations] : relations;
    return this;
  }
}
