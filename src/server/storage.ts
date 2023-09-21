//
//  storage.ts
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

import { TObject, TUpdateOp, TValue, TQueryOptions, _TValue } from '../internals';
import { QuerySelector } from './query/validator/parser';
import { TSchema } from '../internals/schema';
import { TQueryBaseOptions } from '../internals/query/base';

type CommonFindOptions = { className: string; };
export type FindOptions = CommonFindOptions & TQueryOptions;
export type FindOneOptions = CommonFindOptions & Omit<TQueryOptions, 'skip' | 'limit'>;

type Decoded<T, R> = Omit<T, keyof R> & R;

export type DecodedBaseQuery = Decoded<TQueryBaseOptions, {
  filter: QuerySelector;
  matches: Record<string, DecodedBaseQuery>;
}>;

export type DecodedQuery<T> = Decoded<T, {
  filter: QuerySelector;
  matches: Record<string, DecodedBaseQuery>;
  includes: string[];
  objectIdSize: number;
}>;

export type InsertOptions = {
  className: string;
  includes: string[];
  matches: Record<string, DecodedBaseQuery>;
  objectIdSize: number;
};

export interface TStorage {

  prepare(schema: Record<string, TSchema>): PromiseLike<void>;
  shutdown(): PromiseLike<void>;

  classes(): string[];

  config(): PromiseLike<Record<string, _TValue>>;
  setConfig(values: Record<string, _TValue>): PromiseLike<void>;

  explain(query: DecodedQuery<FindOptions>): PromiseLike<any>;

  count(query: DecodedQuery<FindOptions>): PromiseLike<number>;
  find(query: DecodedQuery<FindOptions>): AsyncIterable<TObject>;

  insert(options: InsertOptions, attrs: Record<string, TValue>): PromiseLike<TObject | undefined>;

  updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, TUpdateOp>): PromiseLike<TObject | undefined>;
  upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValue>): PromiseLike<TObject | undefined>;
  deleteOne(query: DecodedQuery<FindOneOptions>): PromiseLike<TObject | undefined>;

  deleteMany(query: DecodedQuery<FindOptions>): PromiseLike<number>;

  withConnection<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>
  withTransaction<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: any,
  ): PromiseLike<T>
}
