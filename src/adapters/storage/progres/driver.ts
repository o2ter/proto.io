//
//  driver.ts
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
import { Pool, PoolConfig, PoolClient } from 'pg';
import QueryStream from 'pg-query-stream';
import { asyncIterableToArray } from '../../../internals';

class PostgresClientDriver {

  client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  query(text: string, values: any[] = [], batchSize?: number) {
    const client = this.client;
    const iterator = async function* () {
      const stream = new QueryStream(text, values, { batchSize });
      client.query(stream);
      try {
        for await (const row of stream) yield row;
      } finally {
        stream.destroy();
      }
    };
    return {
      then(...args: Parameters<Promise<any[]>['then']>) {
        return asyncIterableToArray({ [Symbol.asyncIterator]: iterator }).then(...args);
      },
      [Symbol.asyncIterator]: iterator,
    };
  }

  async version() {
    const rows = await this.query('SELECT version()');
    return rows[0].version as string;
  }
}

export class PostgresDriver {

  database: Pool;

  constructor(config: string | PoolConfig) {
    this.database = new Pool(_.isString(config) ? { connectionString: config } : config);
  }

  async shutdown() {
    await this.database.end();
  }

  async withClient<T>(callback: (client: PostgresClientDriver) => PromiseLike<T>) {
    const client = await this.database.connect();
    try {
      return await callback(new PostgresClientDriver(client));
    } finally {
      client.release();
    }
  }

  query(text: string, values: any[] = [], batchSize?: number) {
    const database = this.database;
    const iterator = async function* () {
      const _client = await database.connect();
      const client = new PostgresClientDriver(_client);
      try {
        const stream = client.query(text, values, batchSize);
        for await (const row of stream) yield row;
      } finally {
        _client.release();
      }
    };
    return {
      then(...args: Parameters<Promise<any[]>['then']>) {
        return asyncIterableToArray({ [Symbol.asyncIterator]: iterator }).then(...args);
      },
      [Symbol.asyncIterator]: iterator,
    };
  }

  async version() {
    const rows = await this.query('SELECT version()');
    return rows[0].version as string;
  }
}
