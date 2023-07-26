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
import {
  TObject,
  UpdateOp,
  TSchema,
  FindOptions,
  FindOneOptions,
  ExplainOptions,
  TValue,
} from '../internals';

export interface TStorage {

  prepare(schema: Record<string, TSchema>): PromiseLike<void>;
  shutdown(): PromiseLike<void>;

  classes(): string[] | PromiseLike<string[]>;

  explain(query: ExplainOptions): PromiseLike<any>;

  count(query: FindOptions): PromiseLike<number>;
  find(query: FindOptions): AsyncIterable<TObject>;

  insert(className: string, attrs: Record<string, any>): PromiseLike<TObject | undefined>;

  findOneAndUpdate(query: FindOneOptions, update: Record<string, [UpdateOp, TValue]>): PromiseLike<TObject | undefined>;
  findOneAndReplace(query: FindOneOptions, replacement: Record<string, any>): PromiseLike<TObject | undefined>;
  findOneAndUpsert(query: FindOneOptions, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, any>): PromiseLike<TObject | undefined>;
  findOneAndDelete(query: FindOneOptions): PromiseLike<TObject | undefined>;

  findAndDelete(query: FindOptions): PromiseLike<number>;
}
