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

import { QuerySelector } from '../query/dispatcher/parser';
import { TSchema } from '../../internals/schema';
import { TQueryBaseOptions } from '../../internals/query/base';
import { TransactionOptions } from '../../internals/proto';
import { TQueryOptions } from '../../internals/query';
import { TValueWithoutObject, TValueWithUndefined } from '../../internals/types';
import { TObject } from '../../internals/object';
import { TUpdateOp } from '../../internals/object/types';
import { QueryExpression } from '../query/dispatcher/parser/expressions';
import { QueryAccumulator } from '../query/dispatcher/parser/accumulators';

export type FindOptions = { className: string; } & TQueryOptions;

export type RelationOptions = {
  relatedBy?: {
    className: string;
    objectId: string;
    key: string;
  };
};

type Decoded<T, R> = Omit<T, keyof R> & R;

export type DecodedSortOption = {
  expr: QueryExpression;
  order: 1 | -1;
};

export type DecodedBaseQuery = Decoded<TQueryBaseOptions, {
  filter?: QuerySelector;
  matches: Record<string, DecodedBaseQuery>;
  groupMatches?: Record<string, Record<string, QueryAccumulator>>;
  sort?: Record<string, 1 | -1> | DecodedSortOption[];
}>;

export type DecodedQuery<T> = Decoded<T, {
  filter: QuerySelector;
  matches: Record<string, DecodedBaseQuery>;
  groupMatches: Record<string, Record<string, QueryAccumulator>>;
  includes: string[];
  objectIdSize: number;
  sort?: Record<string, 1 | -1> | DecodedSortOption[];
  extraFilter?: (className: string) => QuerySelector;
}>;

export type InsertOptions = {
  className: string;
  includes: string[];
  matches: Record<string, DecodedBaseQuery>;
  groupMatches: Record<string, Record<string, QueryAccumulator>>;
  objectIdSize: number;
};

export type QueryRandomOptions = {
  weight?: QueryExpression;
};

export interface TStorage {

  selectLock(): boolean;

  prepare(schema: Record<string, TSchema>): PromiseLike<void>;
  shutdown(): PromiseLike<void>;

  classes(): string[];

  config(acl?: string[]): PromiseLike<Record<string, TValueWithoutObject>>;
  configAcl(): PromiseLike<Record<string, string[]>>;
  setConfig(values: Record<string, TValueWithoutObject>, acl?: string[]): PromiseLike<void>;

  explain(query: DecodedQuery<FindOptions & RelationOptions>): PromiseLike<any>;

  count(query: DecodedQuery<FindOptions & RelationOptions>): PromiseLike<number>;
  find(query: DecodedQuery<FindOptions & RelationOptions>): AsyncIterable<TObject>;
  random(query: DecodedQuery<FindOptions & RelationOptions>, opts?: QueryRandomOptions): AsyncIterable<TObject>;

  refs(object: TObject, classNames: string[], roles?: string[]): AsyncIterable<TObject>;
  nonrefs(query: DecodedQuery<FindOptions>): AsyncIterable<TObject>;

  insert(options: InsertOptions, values: Record<string, TValueWithUndefined>[]): PromiseLike<TObject[]>;
  update(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>): PromiseLike<TObject[]>;
  upsert(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValueWithUndefined>): PromiseLike<TObject[]>;
  delete(query: DecodedQuery<FindOptions>): PromiseLike<TObject[]>;

  lockTable(className: string | string[], update: boolean): Promise<void>;

  withConnection<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>;

  isDuplicateIdError(error: any): boolean;

  atomic<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: { lockTable?: string; retry?: boolean; },
  ): PromiseLike<T>;

  withTransaction<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: TransactionOptions,
  ): PromiseLike<T>;
}
