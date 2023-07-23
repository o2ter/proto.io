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
import { MongoClient, MongoClientOptions } from 'mongodb';
import { TStorage } from '../../common/storage';
import { TSchema } from '../../common/schema';
import { storageSchedule } from '../../common/schedule';

export class MongoStorage implements TStorage {

  schedule = storageSchedule(this, []);

  connection: MongoClient;
  schema: Record<string, TSchema> = {};

  constructor(uri: string, options?: MongoClientOptions) {
    this.connection = new MongoClient(uri, options);
  }

  async connect() {
    await this.connection.connect();
    return this;
  }

  async close(force?: boolean) {
    this.schedule?.destory();
    await this.connection.close(force);
  }

  static async connect(uri: string, options?: MongoClientOptions) {
    const storage = new MongoStorage(uri, options);
    return storage.connect();
  }

  prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
  }

  classes() {
    return Object.keys(this.schema);
  }

  async count() {
    return 0;
  }

  async* find() {
    return [];
  }

  async insert() {
    return undefined;
  }

  async findOneAndUpdate() {
    return undefined;
  }

  async findOneAndReplace() {
    return undefined;
  }

  async findOneAndUpsert() {
    return undefined;
  }

  async findOneAndDelete() {
    return undefined;
  }

  async findAndDelete() {
    return 0;
  }

}

export default MongoStorage;