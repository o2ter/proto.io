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
import { PUser } from './user';
import { PObject } from './object';
import { PQuery } from './query';

type FindOptions = Omit<PQuery.Options, 'returning'> & { model: string; };
type FindOneOptions = Omit<PQuery.Options, 'skip' | 'limit'> & { model: string; };

export interface Storage<Schema> {

  prepare(schema: Schema): PromiseLike<void>;

  roles(user?: PUser): PromiseLike<string[]>;
  models(user?: PUser): PromiseLike<string[]>;

  count(query: FindOptions, user?: PUser): PromiseLike<number>;
  find(query: FindOptions, user?: PUser): PromiseLike<PObject[]>;

  insert(model: string, attrs: any, user?: PUser): PromiseLike<PObject | undefined>;

  findOneAndUpdate(query: FindOneOptions, update: any, user?: PUser): PromiseLike<PObject | undefined>;
  findOneAndUpsert(query: FindOneOptions, update: any, setOnInsert: any, user?: PUser): PromiseLike<PObject | undefined>;
  findOneAndDelete(query: FindOneOptions, user?: PUser): PromiseLike<PObject | undefined>;

  findAndDelete(query: FindOptions, user?: PUser): PromiseLike<number>;
}
