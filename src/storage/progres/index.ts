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
import pg, { IInitOptions, IConnectionOptions, IDatabase } from 'pg-promise';
import { IOSchema, IOStorage } from '../../utils/types';

export class PostgresStorage implements IOStorage {

  connection: IDatabase<{}>;
  schema: Record<string, IOSchema> = {};

  constructor(uri: string, options?: IInitOptions) {
    this.connection = pg(options ?? {})(uri);
  }

  async connect(options?: IConnectionOptions) {
    await this.connection.connect(options);
    return this;
  }

  static async connect(uri: string, options?: IInitOptions) {
    const storage = new PostgresStorage(uri, options);
    return storage.connect();
  }

  prepare(schema: Record<string, IOSchema>) {
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

export default PostgresStorage;