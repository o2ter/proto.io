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
import pg, { IConnectionOptions, IDatabase } from 'pg-promise';
import { TSchema, storageSchedule, UpdateOp, TValue } from '../../../internals';
import { ExplainOptions, FindOneOptions, FindOptions, TStorage } from '../../../server/storage';

const pgp = pg({});

export class PostgresStorage implements TStorage {

  schedule = storageSchedule(this, ['expireDocument']);

  connection: IDatabase<{}>;
  schema: Record<string, TSchema> = {};

  constructor(uri: string) {
    this.connection = pgp(uri);
  }

  async connect(options?: IConnectionOptions) {
    await this.connection.connect(options);
    return this;
  }

  async shutdown() {
    this.schedule?.destory();
  }

  static async connect(uri: string, options?: IConnectionOptions) {
    const storage = new PostgresStorage(uri);
    return storage.connect(options);
  }

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
    this.schedule?.execute();
  }

  classes() {
    return Object.keys(this.schema);
  }

  async explain(query: ExplainOptions) {
    return 0;
  }

  async count(query: FindOptions) {
    return 0;
  }

  async* find(query: FindOptions) {
    return [];
  }

  async insert(className: string, attrs: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpdate(query: FindOneOptions, update: Record<string, [UpdateOp, TValue]>) {
    return undefined;
  }

  async findOneAndReplace(query: FindOneOptions, replacement: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpsert(query: FindOneOptions, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndDelete(query: FindOneOptions) {
    return undefined;
  }

  async findAndDelete(query: FindOptions) {
    return 0;
  }

}

export default PostgresStorage;