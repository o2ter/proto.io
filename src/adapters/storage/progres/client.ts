//
//  client.ts
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
import { _TValue } from '../../../internals';
import { PostgresClientDriver } from './driver';
import { SqlStorage, sql } from '../../../server/sql';
import { PostgresDialect, _decodeValue, _encodeValue, _encodeJsonValue } from './dialect';
import { QueryCompiler } from '../../../server/sql/compiler';
import { DecodedQuery, FindOptions } from '../../../server/storage';
import { ScheduleOp } from '../../../server/schedule';
import { PostgresStorageTransaction, transactionBeginMap } from './transaction';

export class PostgresStorageClient<Driver extends PostgresClientDriver> extends SqlStorage {

  protected _driver: Driver;

  constructor(driver: Driver, schedule?: ScheduleOp[]) {
    super(schedule);
    this._driver = driver;
  }

  get dialect() {
    return PostgresDialect;
  }

  async config() {
    const config: Record<string, _TValue> = {};
    const query = sql`SELECT * FROM ${{ identifier: '_Config' }}`;
    for await (const record of this.query(query)) {
      config[record._id] = _decodeValue(record.value);
    }
    return config;
  }
  async setConfig(values: Record<string, _TValue>) {
    const _values = _.pickBy(values, v => !_.isNil(v));
    const nilKeys = _.keys(_.pickBy(values, v => _.isNil(v)));
    if (!_.isEmpty(_values)) {
      await this.query(sql`
        INSERT INTO ${{ identifier: '_Config' }} (_id, value)
        VALUES
        ${_.map(_values, (v, k) => sql`(${{ value: k }}, ${_encodeJsonValue(_encodeValue(v))})`)}
        ON CONFLICT (_id) DO UPDATE SET value = EXCLUDED.value;
      `);
    }
    if (!_.isEmpty(nilKeys)) {
      await this.query(sql`
        DELETE FROM ${{ identifier: '_Config' }}
        WHERE _id IN (${_.map(nilKeys, k => sql`${{ value: k }}`)})
      `);
    }
  }

  _query(text: string, values: any[] = [], batchSize?: number) {
    return this._driver.query(text, values, batchSize);
  }

  async _explain(compiler: QueryCompiler, query: DecodedQuery<FindOptions>) {
    const explains = await this.query(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${compiler._selectQuery(query)}`);
    return _.first(explains)['QUERY PLAN'];
  }

  classes() {
    return Object.keys(this.schema);
  }

  async version() {
    return this._driver.version();
  }

  async databases() {
    return this._driver.databases();
  }

  async tables() {
    return this._driver.tables();
  }

  async views() {
    return this._driver.views();
  }

  async materializedViews() {
    return this._driver.materializedViews();
  }

  async columns(table: string, namespace?: string) {
    return this._driver.columns(table, namespace);
  }

  async indices(table: string, namespace?: string) {
    return this._driver.indices(table, namespace);
  }

  withConnection<T>(
    callback: (connection: PostgresStorageClient<PostgresClientDriver>) => PromiseLike<T>
  ) {
    return callback(this);
  }

  withTransaction<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>,
    options?: any,
  ) {
    return this.withConnection(async (connection) => {

      const transaction = new PostgresStorageTransaction(connection._driver);

      try {

        const _begin = _.isString(options?.mode)
          ? transactionBeginMap[options.mode as keyof typeof transactionBeginMap] ?? transactionBeginMap.default
          : transactionBeginMap.default;

        await transaction.query(_begin);
        const result = await callback(transaction);
        await transaction.query(sql`COMMIT`);

        return result

      } catch (e) {
        await transaction.query(sql`ROLLBACK`);
        throw e;
      }
    });
  }
}
