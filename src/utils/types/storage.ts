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
import { PObject } from './object';
import { PQuery } from './query';
import { PSchema } from './schema';

type FindOptions = Omit<PQuery.Options, 'returning'> & { model: string; };
type FindOneOptions = Omit<PQuery.Options, 'skip' | 'limit'> & { model: string; };

export interface PStorage {

  prepare(schema: Record<string, PSchema>): PromiseLike<void>;
  models(): string[] | PromiseLike<string[]>;

  count(query: FindOptions): PromiseLike<number>;
  find(query: FindOptions): PromiseLike<PObject[]>;

  insert(model: string, attrs: any): PromiseLike<PObject | undefined>;

  findOneAndUpdate(query: FindOneOptions, update: any): PromiseLike<PObject | undefined>;
  findOneAndUpsert(query: FindOneOptions, update: any, setOnInsert: any): PromiseLike<PObject | undefined>;
  findOneAndDelete(query: FindOneOptions): PromiseLike<PObject | undefined>;

  findAndDelete(query: FindOptions): PromiseLike<number>;
}
