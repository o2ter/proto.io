//
//  index.ts
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
import { UpdateOp, TValue } from '../../../internals';
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions, TStorage } from '../../../server/storage';
import { storageSchedule } from '../../../server/schedule';
import { TSchema } from '../../../server/schema';

export class MemoryStorage implements TStorage {

  schedule = storageSchedule(this, ['expireDocument']);

  schema: Record<string, TSchema> = {};

  async shutdown() {
    this.schedule?.destory();
  }

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
    this.schedule?.execute();
  }

  classes() {
    return Object.keys(this.schema);
  }

  async explain(query: DecodedQuery<ExplainOptions>) {
    return 0;
  }

  async count(query: DecodedQuery<FindOptions>) {
    return 0;
  }

  async* find(query: DecodedQuery<FindOptions>) {
    return [];
  }

  async insert(className: string, attrs: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpdate(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    return undefined;
  }

  async findOneAndReplace(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpsert(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndDelete(query: DecodedQuery<FindOneOptions>) {
    return undefined;
  }

  async findAndDelete(query: DecodedQuery<FindOptions>) {
    return 0;
  }

};

export default MemoryStorage;