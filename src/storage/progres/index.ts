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
import { FindOptions, TStorage } from '../../common/storage';
import { TSchema } from '../../common/schema';

const pgp = pg({});

export class PostgresStorage implements TStorage {

  static _scheduleCallback(storage: PostgresStorage) {
    (async () => {
      for (const className of storage.classes()) {
        await storage.findAndDelete({
          className,
          filter: { _expired_at: { $lt: new Date() } },
          options: { master: true, acls: [] },
        });
      }
    })();
  }

  interval = setInterval(PostgresStorage._scheduleCallback, 60 * 1000, this);

  connection: IDatabase<{}>;
  schema: Record<string, TSchema> = {};

  constructor(uri: string) {
    this.connection = pgp(uri);
  }

  async connect(options?: IConnectionOptions) {
    await this.connection.connect(options);
    return this;
  }

  async close() {
    clearInterval(this.interval);
  }

  static async connect(uri: string, options?: IConnectionOptions) {
    const storage = new PostgresStorage(uri);
    return storage.connect(options);
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

  async findAndDelete(query: FindOptions) {
    return 0;
  }

}

export default PostgresStorage;