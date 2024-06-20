//
//  base.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { PostgresClientDriver, PostgresDriver } from '../driver';
import { SQL, SqlStorage, sql } from '../../../../server/storage/sql';
import { PostgresDialect } from '../dialect';
import { _encodeJsonValue } from '../dialect/encode';
import { QueryCompiler } from '../../../../server/storage/sql/compiler';
import { DecodedQuery, FindOptions } from '../../../../server/storage';
import { EventData, TransactionOptions } from '../../../../internals/proto';
import { TObject, _decodeValue, _encodeValue } from '../../../../internals/object';
import { _TValue } from '../../../../internals/types';
import { TPubSub } from '../../../../server/pubsub';
import { QuerySelector } from '../../../../server/query/dispatcher/parser';
import { TSchema, isPointer, isRelation } from '../../../../internals/schema';

export class PostgresStorageClient<Driver extends PostgresClientDriver> extends SqlStorage implements TPubSub {

  protected _driver: Driver;

  constructor(driver: Driver) {
    super();
    this._driver = driver;
  }

  get dialect() {
    return PostgresDialect;
  }

  selectLock() {
    return false;
  }

  async config(acl?: string[]) {
    const config: Record<string, _TValue> = {};
    const query = _.isNil(acl)
      ? sql`SELECT * FROM ${{ identifier: '_Config' }}`
      : sql`SELECT * FROM ${{ identifier: '_Config' }} WHERE _rperm && ${{ value: acl }}`;
    for await (const record of this.query(query)) {
      config[record._id] = _decodeValue(record.value);
    }
    return config;
  }
  async configAcl() {
    const config: Record<string, string[]> = {};
    const query = sql`SELECT * FROM ${{ identifier: '_Config' }}`;
    for await (const record of this.query(query)) {
      config[record._id] = record._rperm;
    }
    return config;
  }
  async setConfig(values: Record<string, _TValue>, acl?: string[]) {
    const _values = _.pickBy(values, v => !_.isNil(v));
    const nilKeys = _.keys(_.pickBy(values, v => _.isNil(v)));
    if (!_.isEmpty(_values)) {
      await this.query(sql`
        INSERT INTO ${{ identifier: '_Config' }}
        ${_.isNil(acl) ? sql`(_id, value)` : sql`(_id, _rperm, value)`}
        VALUES
        ${_.map(_values, (v, k) => _.isNil(acl)
        ? sql`(${{ value: k }}, ${_encodeJsonValue(_encodeValue(v))})`
        : sql`(${{ value: k }}, ${{ value: acl }}, ${_encodeJsonValue(_encodeValue(v))})`)}
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
    const [explain] = await this.query(sql`EXPLAIN (ANALYZE, VERBOSE, BUFFERS, FORMAT JSON) ${compiler._selectQuery(query)}`);
    return explain['QUERY PLAN'];
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

  async lockTable(table: string | string[], update: boolean): Promise<void> {
    await this.query(sql`
      LOCK ${_.map(_.castArray(table), x => sql`${{ identifier: x }}`)} 
      IN ${update ? sql`EXCLUSIVE` : sql`SHARE`} MODE 
      NOWAIT
    `);
  }

  withConnection<T>(
    callback: (connection: PostgresStorageClient<PostgresClientDriver>) => PromiseLike<T>
  ) {
    return callback(this);
  }

  atomic<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>
  ): PromiseLike<T> {
    return this.withTransaction(callback, { mode: 'repeatable', retry: true });
  }

  async withTransaction<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>,
    options?: TransactionOptions,
  ): Promise<T> {

    const beginMap = {
      'committed': sql`BEGIN ISOLATION LEVEL READ COMMITTED`,
      'repeatable': sql`BEGIN ISOLATION LEVEL REPEATABLE READ`,
      'serializable': sql`BEGIN ISOLATION LEVEL SERIALIZABLE`,
      default: sql`BEGIN`,
    };

    const _begin = options && _.isString(options.mode)
      ? beginMap[options.mode as keyof typeof beginMap] ?? beginMap.default
      : beginMap.default;

    try {

      return await this.withConnection(async (connection) => {

        const transaction = new PostgresStorageTransaction(connection._driver, 0, options?.mode === 'repeatable');
        transaction.schema = this.schema;

        try {

          await transaction.query(_begin);
          const result = await callback(transaction);
          await transaction.query(sql`COMMIT`);

          return result

        } catch (e: any) {
          await transaction.query(sql`ROLLBACK`);
          throw e;
        }
      });

    } catch (e: any) {

      if (options?.retry && ['40001', '40P01', '55P03'].includes(e.code)) {
        return this.withTransaction(callback, {
          ...options,
          retry: _.isNumber(options.retry) ? Math.max(0, options.retry - 1) : options.retry,
        });
      }

      throw e;
    }
  }

  subscribe(callback: (payload: EventData) => void) {
    const db = this._driver;
    if (!(db instanceof PostgresDriver)) throw Error('Invalid pubsub instance');
    return db.subscribe(callback);
  }

  publish(payload: EventData) {
    return this._driver.publish(payload);
  }

  private _refs(
    schema: Record<string, TSchema>,
    className: string,
    keys: string[],
    item: SQL,
  ) {
    const _schema = _.pickBy(_.mapValues(schema, s => _.pickBy(
      s.fields,
      f => (isPointer(f) || (isRelation(f) && _.isNil(f.foreignField))) && f.target === className
    )) as Record<string, Record<string, TSchema.PointerType | TSchema.RelationType>>, s => !_.isEmpty(s));
    return sql`${{
      literal: _.map(_schema, (fields, className) => sql`
        SELECT
        ${{ quote: className }} AS ${{ identifier: '_class' }},
        ${_.map(keys, k => sql`${{ identifier: className }}.${{ identifier: k }}`)}
        FROM ${{ identifier: className }}
        WHERE ${{
          literal: _.map(fields, (f, key) => isPointer(f)
            ? sql`${item} = ${{ identifier: className }}.${{ identifier: key }}`
            : sql`${item} = ANY(${{ identifier: className }}.${{ identifier: key }})`),
          separator: ' OR ',
        }}
      `),
      separator: ' UNION '
    }}`;
  }

  refs(object: TObject, classNames: string[], roles?: string[]): AsyncIterable<TObject> {
    const self = this;
    const query = sql`
      SELECT *
      FROM (${this._refs(
        _.pick(this.schema, classNames), object.className, TObject.defaultKeys,
        sql`${{ value: `${object.className}$${object.objectId}` }}`,
      )}) AS "$"
      ${_.isNil(roles) ? sql`` : sql`WHERE ${{ identifier: '$' }}.${{ identifier: '_rperm' }} && ${{ value: _encodeValue(roles) }}`}
    `;
    return (async function* () {
      const objects = self.query(query);
      for await (const { _class, ...object } of objects) {
        yield self._decodeObject(_class, object);
      }
    })();
  }
  nonrefs(className: string, roles?: string[]): AsyncIterable<TObject> {
    const self = this;
    const query = sql`
      SELECT
        ${_.map(TObject.defaultKeys, k => sql`${{ identifier: className }}.${{ identifier: k }}`)}
      FROM ${{ identifier: className }} AS "$"
      WHERE NOT EXISTS (${this._refs(
        this.schema, className, ['_id'],
        sql`(${{ quote: className + '$' }} || ${{ identifier: '$' }}.${{ identifier: '_id' }})`,
      )})
      ${_.isNil(roles) ? sql`` : sql`AND ${{ identifier: '$' }}.${{ identifier: '_rperm' }} && ${{ value: _encodeValue(roles) }}`}
    `;
    return (async function* () {
      const objects = self.query(query);
      for await (const object of objects) {
        yield self._decodeObject(className, object);
      }
    })();
  }
}

class PostgresStorageTransaction extends PostgresStorageClient<PostgresClientDriver> {

  counter: number;
  private _selectLock: boolean;

  constructor(driver: PostgresClientDriver, counter: number, selectLock: boolean) {
    super(driver);
    this.counter = counter;
    this._selectLock = selectLock;
  }

  selectLock() {
    return this._selectLock;
  }

  override atomic<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>
  ) {
    return callback(this);
  }

  override async withTransaction<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>
  ) {

    const transaction = new PostgresStorageTransaction(this._driver, this.counter + 1, this._selectLock);
    transaction.schema = this.schema;

    try {

      await transaction.query(sql`SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);
      const result = await callback(transaction);
      await transaction.query(sql`RELEASE SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);

      return result;

    } catch (e) {
      await transaction.query(sql`ROLLBACK TO SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);
      throw e;
    }
  }
}
