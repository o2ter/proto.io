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

  db: Pool | PoolClient;

  constructor(db: Pool | PoolClient) {
    this.db = db;
  }

  query(text: string, values: any[] = [], batchSize?: number) {
    const db = this.db;
    const iterator = async function* () {
      const client = db instanceof Pool ? await db.connect() : db;
      const stream = new QueryStream(text, values, { batchSize });
      client.query(stream);
      try {
        for await (const row of stream) yield row;
      } finally {
        stream.destroy();
        if (db instanceof Pool) client.release();
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

  async databases() {
    return _.compact(_.map(
      await this.query('SELECT datname FROM pg_catalog.pg_database'),
      x => x.datname as string
    ));
  }

  async tables() {
    return _.compact(_.map(
      await this.query(`
        SELECT tablename FROM pg_catalog.pg_tables
        WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
      `),
      x => x.tablename as string
    ));
  }

  async views() {
    return _.compact(_.map(
      await this.query(`
        SELECT viewname FROM pg_catalog.pg_views
        WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
      `),
      x => x.viewname as string
    ));
  }

  async materializedViews() {
    return _.compact(_.map(
      await this.query(`
        SELECT matviewname FROM pg_catalog.pg_matviews
        WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
      `),
      x => x.matviewname as string
    ));
  }

}

export class PostgresDriver extends PostgresClientDriver {

  database: Pool;

  constructor(config: string | PoolConfig) {
    const database = new Pool(_.isString(config) ? { connectionString: config } : config);
    super(database);
    this.database = database;
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
}
