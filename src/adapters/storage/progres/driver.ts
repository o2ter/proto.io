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

  async columns(table: string, namespace?: string) {
    const columns = await this.query(`
      SELECT
          a.attname AS column_name,
          format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnum ,
          a.attnotnull
      FROM
          pg_namespace n,
          pg_class t,
          pg_attribute a
      WHERE
          a.attnum > 0
          AND n.oid = t.relnamespace
          AND a.attrelid = t.oid
          AND NOT a.attisdropped
          AND t.relname = '${table}'
          ${namespace ? `AND n.nspname = '${namespace}'` : ''}
    `);
    return _.map(columns, ({ column_name, data_type, attnotnull }) => ({
      name: column_name as string,
      type: data_type as string,
      required: !!attnotnull,
    }));
  }

  async indices(table: string, namespace?: string) {
    const indices = await this.query(`
      SELECT
          n.nspname AS schema_name,
          t.relname AS table_name,
          i.relname AS index_name,
          ix.indisprimary AS is_primary,
          ix.indisunique AS is_unique,
          a.attname AS column_name,
          k.indseq AS seq
      FROM
          pg_namespace n,
          pg_class t,
          pg_class i,
          pg_index ix,
          UNNEST(ix.indkey) WITH ORDINALITY k(attnum, indseq),
          pg_attribute a
      WHERE
          t.oid = ix.indrelid
          AND n.oid = t.relnamespace
          AND i.oid = ix.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = k.attnum
          AND t.relkind = 'r'
          AND t.relname = '${table}'
          ${namespace ? `AND n.nspname = '${namespace}'` : ''}
    `);
    return indices;
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
