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

import _ from 'lodash';
import { TObject, UpdateOp, TValue, TQuery } from '../internals';
import { QuerySelector } from './query/parser';
import { TSchema } from './schema';

type CommonFindOptions = { className: string; };
export type ExplainOptions = CommonFindOptions & Omit<TQuery.Options, 'returning' | 'skip' | 'limit'>;
export type FindOptions = CommonFindOptions & Omit<TQuery.Options, 'returning'>;
export type FindOneOptions = CommonFindOptions & Omit<TQuery.Options, 'skip' | 'limit'>;

export type DecodedQuery<T> = Omit<T, 'filter'> & { filter: QuerySelector; };

export interface TStorage {

  prepare(schema: Record<string, TSchema>): PromiseLike<void>;
  shutdown(): PromiseLike<void>;

  classes(): string[];

  explain(query: DecodedQuery<ExplainOptions>): PromiseLike<any>;

  count(query: DecodedQuery<FindOptions>): PromiseLike<number>;
  find(query: DecodedQuery<FindOptions>): AsyncIterable<TObject>;

  insert(className: string, attrs: Record<string, TValue>): PromiseLike<TObject | undefined>;

  findOneAndUpdate(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>): PromiseLike<TObject | undefined>;
  findOneAndReplace(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>): PromiseLike<TObject | undefined>;
  findOneAndUpsert(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>): PromiseLike<TObject | undefined>;
  findOneAndDelete(query: DecodedQuery<FindOneOptions>): PromiseLike<TObject | undefined>;

  findAndDelete(query: DecodedQuery<FindOptions>): PromiseLike<number>;
}
