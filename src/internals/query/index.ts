//
//  index.ts
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
import { IncludePaths } from './types';
import { TValue } from '../types';
import { PVK } from '../private';
import { TObjectType } from '../object/types';
import { TQueryBase, TQueryBaseOptions } from './base';
import { TUpdateOp } from '../object/types';
import { ExtraOptions } from '../options';
import { asyncStream, Awaitable } from '@o2ter/utils-js';

/**
 * Options for a query.
 */
export interface TQueryOptions extends TQueryBaseOptions {
  /**
   * Fields to include in the query.
   */
  includes?: string[];
};

/**
 * Options for a random query.
 */
export interface TQueryRandomOptions {
  /**
   * Field to use for weighting the random selection.
   */
  weight?: string;
};

/**
 * Abstract base class for queries.
 */
export abstract class TQuery<T extends string, Ext, M extends boolean> extends TQueryBase {

  /** @internal */
  [PVK]: { options: TQueryOptions; } = { options: {} };

  /**
   * Clones the query with optional new options.
   * @param options - The new options for the query.
   * @returns A new query instance.
   */
  abstract clone(options?: TQueryOptions): TQuery<T, Ext, M>;

  /**
   * Explains the query execution plan.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the explanation.
   */
  abstract explain(options?: ExtraOptions<M>): PromiseLike<any>;

  /**
   * Counts the number of results for the query.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the count.
   */
  abstract count(options?: ExtraOptions<M>): PromiseLike<number>;

  /**
   * Finds the results for the query.
   * @param options - Extra options for the query.
   * @returns A stream of the results.
   */
  abstract find(options?: ExtraOptions<M>): ReturnType<typeof asyncStream<TObjectType<T, Ext>>>;

  /**
   * Selects a random result for the query.
   * @param opts - Options for the random selection.
   * @param options - Extra options for the query.
   * @returns A stream of the random result.
   */
  abstract random(
    opts?: TQueryRandomOptions,
    options?: ExtraOptions<M>
  ): ReturnType<typeof asyncStream<TObjectType<T, Ext>>>;

  /**
   * Finds non-reference results for the query.
   * @param options - Extra options for the query.
   * @returns A stream of the non-reference results.
   */
  abstract nonrefs(options?: ExtraOptions<M>): ReturnType<typeof asyncStream<TObjectType<T, Ext>>>;

  /**
   * Inserts a new record.
   * @param attrs - The attributes of the new record.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the inserted record.
   */
  abstract insert(
    attrs: Record<string, TValue>,
    options?: ExtraOptions<M>
  ): PromiseLike<TObjectType<T, Ext>>;

  /**
   * Inserts multiple new records.
   * @param values - The attributes of the new records.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the number of inserted records.
   */
  abstract insertMany(
    values: Record<string, TValue>[],
    options?: ExtraOptions<M>
  ): PromiseLike<number>;

  /**
   * Updates a single record.
   * @param update - The update operations.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the updated record or undefined.
   */
  abstract updateOne(
    update: Record<string, TUpdateOp>,
    options?: ExtraOptions<M>
  ): PromiseLike<TObjectType<T, Ext> | undefined>;

  /**
   * Updates multiple records.
   * @param update - The update operations.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the number of updated records.
   */
  abstract updateMany(
    update: Record<string, TUpdateOp>,
    options?: ExtraOptions<M>
  ): PromiseLike<number>;

  /**
   * Upserts a single record.
   * @param update - The update operations.
   * @param setOnInsert - The attributes to set on insert.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the upserted record.
   */
  abstract upsertOne(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValue>,
    options?: ExtraOptions<M>
  ): PromiseLike<TObjectType<T, Ext>>;

  /**
   * Upserts multiple records.
   * @param update - The update operations.
   * @param setOnInsert - The attributes to set on insert.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the number of upserted records.
   */
  abstract upsertMany(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValue>,
    options?: ExtraOptions<M>
  ): PromiseLike<{ updated: number; inserted: number; }>;

  /**
   * Deletes a single record.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the deleted record or undefined.
   */
  abstract deleteOne(options?: ExtraOptions<M>): PromiseLike<TObjectType<T, Ext> | undefined>;

  /**
   * Deletes multiple records.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the number of deleted records.
   */
  abstract deleteMany(options?: ExtraOptions<M>): PromiseLike<number>;

  /**
   * Adds fields to include in the query.
   * @param includes - The fields to include.
   * @returns The query instance.
   */
  includes<T extends _.RecursiveArray<string>>(...includes: IncludePaths<T>) {
    this[PVK].options.includes = this[PVK].options.includes ? [...this[PVK].options.includes, ..._.flattenDeep(includes)] : _.flattenDeep(includes);
    return this;
  }

  /**
   * Gets a record by its ID.
   * @param id - The ID of the record.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the record or undefined.
   */
  async get(id: string, options?: ExtraOptions<M>) {
    return _.first(await this.clone().equalTo('_id', id).limit(1).find(options));
  }

  /**
   * Gets the first record.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the first record or undefined.
   */
  async first(options?: ExtraOptions<M>) {
    return _.first(await this.clone().limit(1).find(options));
  }

  /**
   * Gets a random record.
   * @param opts - Options for the random selection.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to the random record or undefined.
   */
  async randomOne(opts?: TQueryRandomOptions, options?: ExtraOptions<M>) {
    return _.first(await this.clone().limit(1).random(opts, options));
  }

  /**
   * Checks if any records exist.
   * @param options - Extra options for the query.
   * @returns A promise that resolves to a boolean indicating if any records exist.
   */
  async exists(options?: ExtraOptions<M>) {
    const query = this.clone();
    this[PVK].options.includes = [];
    return !_.isNil(await query.limit(1).find(options));
  }

  /**
   * Iterates over each batch of records.
   * @param callback - The callback to execute for each batch.
   * @param options - Extra options for the query.
   */
  async eachBatch(
    callback: (batch: TObjectType<T, Ext>[]) => Awaitable<void>,
    options?: ExtraOptions<M> & { batchSize?: number; },
  ) {
    const sorting = this[PVK].options.sort as Record<string, 1 | -1> ?? {};
    const batchSize = options?.batchSize ?? 100;
    if (!_.isPlainObject(sorting)) throw Error('Unsupported sort method');
    const is_asc = _.every(sorting, v => v === 1);
    const is_desc = _.every(sorting, v => v === -1);
    if (!is_asc && !is_desc) throw Error('Unsupported sort method');
    if (_.isNil(sorting._id)) sorting._id = is_asc ? 1 : -1;
    const query = this.clone().sort(sorting).limit(batchSize);
    const keys = _.keys(sorting);
    let batch: TObjectType<T, Ext>[] = [];
    while (true) {
      options?.abortSignal?.throwIfAborted();
      const q = _.isEmpty(batch) ? query : query.clone()
        .filter(keys.length > 1 ? {
          $expr: {
            [is_asc ? '$gt' : '$lt']: [
              { $array: _.map(keys, k => ({ $key: k })) },
              { $array: _.map(keys, k => ({ $value: _.last(batch)!.get(k) })) },
            ],
          },
        } : {
          [keys[0]]: { [is_asc ? '$gt' : '$lt']: _.last(batch)!.get(keys[0]) },
        });
      batch = await q.find(options);
      if (_.isEmpty(batch)) return;
      await callback(batch);
    }
  }

  /**
   * Iterates over each record.
   * @param callback - The callback to execute for each record.
   * @param options - Extra options for the query.
   */
  async each(
    callback: (object: TObjectType<T, Ext>) => Awaitable<void>,
    options?: ExtraOptions<M> & { batchSize?: number; },
  ) {
    await this.eachBatch(async (batch) => {
      for (const object of batch) {
        await callback(object);
      }
    }, options);
  }
};
