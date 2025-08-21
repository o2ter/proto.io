//
//  index.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { Pool, PoolConfig, PoolClient, types } from 'pg';
import QueryStream from 'pg-query-stream';
import { asyncStream, Awaitable, IteratorPool } from '@o2ter/utils-js';
import Decimal from 'decimal.js';
import { _decodeValue, _encodeValue } from '../../../../internals/object';
import { TValueWithoutObject } from '../../../../internals/types';
import { quote } from '../dialect/basic';
import { PROTO_EVENT } from '../../../../internals/const';

const typeParser = (oid: number, format?: any) => {
  format = format ?? 'text';
  if (format === 'text') {
    switch (oid) {
      case types.builtins.MONEY:
        return (value: string) => new Decimal(value);
    }
  }
  return types.getTypeParser(oid, format);
};

export class PostgresClientDriver {

  db: Pool | PoolClient;

  constructor(db: Pool | PoolClient) {
    this.db = db;
  }

  query(text: string, values: any[] = [], batchSize?: number) {
    const db = this.db;
    return asyncStream(async function* () {
      const client = db instanceof Pool ? await db.connect() : db;
      const stream = new QueryStream(text, values, { batchSize });
      yield* IteratorPool(Number.MAX_SAFE_INTEGER, async function* () {
        client.query(stream);
        try {
          yield* stream;
        } finally {
          stream.destroy();
          if (db instanceof Pool) client.release();
        }
      });
    });
  }

  async version() {
    const [{ version }] = await this.query('SELECT version()');
    return version as string;
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
    return _.mapValues(_.groupBy(indices, 'index_name'), v => ({
      keys: _.map(_.sortBy(v, ({ seq }) => parseInt(seq)), 'column_name'),
      ..._.pick(_.first(v), [
        'schema_name',
        'table_name',
        'index_name',
        'is_primary',
        'is_unique',
      ])
    }));
  }

  async withClient<T>(callback: (client: PostgresClientDriver) => PromiseLike<T>) {
    const client = this.db instanceof Pool ? await this.db.connect() : this.db;
    try {
      return await callback(new PostgresClientDriver(client));
    } finally {
      if (this.db instanceof Pool) client.release();
    }
  }

  async publish(channel: string, payload: TValueWithoutObject) {
    await this.withClient(async (db) => {
      await db.query(`NOTIFY ${PROTO_EVENT}, ${quote(JSON.stringify(_encodeValue({ channel, payload })))}`);
    });
  }
}

class PostgresPubSub {

  client: Awaitable<PoolClient>;
  subscribers: ((payload: TValueWithoutObject) => void)[] = [];

  constructor(client: Awaitable<PoolClient>) {
    this.client = client;
    (async () => {
      try {
        client = await client;
        client.on('notification', ({ channel, payload }) => {
          if (_.toUpper(channel) !== PROTO_EVENT || !payload) return;
          try {
            const _payload = _decodeValue(JSON.parse(payload));
            for (const subscriber of this.subscribers) {
              subscriber(_payload);
            }
          } catch (e) {
            console.error(`Unknown payload: ${e}`);
          }
        });
        await client.query(`LISTEN ${PROTO_EVENT}`);
      } catch (e) {
        console.error(e);
      }
    })();
  }

  async shutdown() {
    (await this.client).release();
  }

  subscribe(callback: (payload: TValueWithoutObject) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(x => x !== callback);
    };
  }

  isEmpty() {
    return _.isEmpty(this.subscribers);
  }
}

export class PostgresDriver extends PostgresClientDriver {

  database: Pool;

  private pubsub?: PostgresPubSub;

  constructor(config: string | PoolConfig) {
    if (_.isEmpty(config)) throw Error('Invalid postgre config.');
    const _types = { getTypeParser: typeParser as typeof types.getTypeParser };
    const database = new Pool(_.isString(config) ? { connectionString: config, types: _types } : { ...config, types: _types });
    super(database);
    this.database = database;
  }

  async shutdown() {
    await this._release_pubsub();
    await this.database.end();
  }

  private _init_pubsub() {
    if (this.pubsub || this.database.ending || this.database.ended) return;
    this.pubsub = new PostgresPubSub(this.database.connect());
  }

  private async _release_pubsub() {
    const pubsub = this.pubsub;
    this.pubsub = undefined;
    await pubsub?.shutdown();
  }

  subscribe(channel: string, callback: (payload: TValueWithoutObject) => void) {
    this._init_pubsub();
    if (!this.pubsub) return () => void 0;
    const release = this.pubsub.subscribe(({ channel: _channel, payload }: any) => {
      if (_channel === channel) callback(payload);
    });
    return () => {
      release();
      if (this.pubsub?.isEmpty()) this._release_pubsub();
    };
  }
}
