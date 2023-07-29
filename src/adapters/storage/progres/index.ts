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
import { PoolConfig } from 'pg';
import { escapeIdentifier } from 'pg/lib/utils';
import { UpdateOp, TValue } from '../../../internals';
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions, TStorage } from '../../../server/storage';
import { storageSchedule } from '../../../server/schedule';
import { TSchema } from '../../../server/schema';
import { PostgresDriver } from './driver';

export class PostgresStorage implements TStorage {

  schedule = storageSchedule(this, ['expireDocument']);

  schema: Record<string, TSchema> = {};
  driver: PostgresDriver;

  constructor(config: string | PoolConfig) {
    this.driver = new PostgresDriver(config);
  }

  async shutdown() {
    this.schedule?.destory();
    await this.driver.shutdown();
  }

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
    this.schedule?.execute();
    for (const [className, _schema] of _.toPairs(schema)) {
      await this.#createTable(className, _schema);
      await this.#dropIndices(className, _schema);
      await this.#createIndices(className, _schema);
    }
  }

  #postgresType(type: TSchema.Primitive | TSchema.Relation) {
    switch (type) {
      case 'boolean': return 'BOOLEAN';
      case 'number': return 'DOUBLE PRECISION';
      case 'decimal': return 'DECIMAL';
      case 'string': return 'TEXT';
      case 'date': return 'TIMESTAMP';
      case 'object': return 'JSONB';
      case 'array': return 'JSONB';
      case 'pointer': return 'TEXT';
      case 'relation': return 'TEXT[]';
    }
  }

  async #createTable(className: string, schema: TSchema) {
    await this.driver.query(`
      CREATE TABLE
      IF NOT EXISTS ${escapeIdentifier(className)}
      (
        _id TEXT PRIMARY KEY,
        __v INTEGER NOT NULL DEFAULT 0,
        _created_at TIMESTAMP NOT NULL DEFAULT now(),
        _updated_at TIMESTAMP NOT NULL DEFAULT now(),
        _expired_at TIMESTAMP,
        _acl TEXT[],
        ${_.map(schema.fields, (type, col) => `
          ${escapeIdentifier(col)} ${this.#postgresType(_.isString(type) ? type : type.type)}
        `).join(',')}
      )
    `);
  }

  async #dropIndices(className: string, schema: TSchema) {
    const relations = _.pickBy(schema.fields, v => !_.isString(v) && v.type === 'relation');
    const indexes = [
      ..._.map(_.keys(relations), k => ({ keys: { [k]: 1 } }) as TSchema.Indexes),
      ...(schema.indexes ?? []),
    ];
    const names: string[] = [];
    for (const index of indexes) {
      if (_.isEmpty(index.keys)) continue;
      names.push(`${className}$${_.map(index.keys, (v, k) => `${k}:${v}`).join('$')}`);
    }
    for (const [name, { is_primary }] of _.toPairs(await this.indices(className))) {
      if (is_primary || names.includes(name)) continue;
      await this.driver.query(`DROP INDEX CONCURRENTLY IF EXISTS ${escapeIdentifier(name)}`);
    }
  }

  async #createIndices(className: string, schema: TSchema) {
    const relations = _.pickBy(schema.fields, v => !_.isString(v) && v.type === 'relation');
    const indexes = [
      ..._.map(_.keys(relations), k => ({ keys: { [k]: 1 } }) as TSchema.Indexes),
      ...(schema.indexes ?? []),
    ];
    for (const index of indexes) {
      if (_.isEmpty(index.keys)) continue;
      const name = `${className}$${_.map(index.keys, (v, k) => `${k}:${v}`).join('$')}`;
      const isAcl = _.isEqual(index.keys, { _acl: 1 });
      const isRelation = _.has(relations, _.last(_.keys(index.keys)) as string);
      await this.driver.query(`
        CREATE ${index.unique ? 'UNIQUE' : ''} INDEX CONCURRENTLY
        IF NOT EXISTS ${escapeIdentifier(name)}
        ON ${escapeIdentifier(className)}
        ${isAcl || isRelation ? 'USING GIN' : ''}
        (
          ${_.map(index.keys, (v, k) => `
            ${escapeIdentifier(k)} ${isAcl || isRelation ? '' : v === 1 ? 'ASC' : 'DESC'}
          `).join(',')}
        )
      `);
    }
  }

  classes() {
    return Object.keys(this.schema);
  }

  async version() {
    return this.driver.version();
  }

  async databases() {
    return this.driver.databases();
  }

  async tables() {
    return this.driver.tables();
  }

  async views() {
    return this.driver.views();
  }

  async materializedViews() {
    return this.driver.materializedViews();
  }

  async columns(table: string, namespace?: string) {
    return this.driver.columns(table, namespace);
  }

  async indices(table: string, namespace?: string) {
    return this.driver.indices(table, namespace);
  }

  async explain(query: DecodedQuery<ExplainOptions>) {
    return 0;
  }

  async count(query: DecodedQuery<FindOptions>) {
    return 0;
  }

  async* find(query: DecodedQuery<FindOptions>) {
    return [];
  }

  async insert(className: string, attrs: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpdate(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    return undefined;
  }

  async findOneAndReplace(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpsert(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndDelete(query: DecodedQuery<FindOneOptions>) {
    return undefined;
  }

  async findAndDelete(query: DecodedQuery<FindOptions>) {
    return 0;
  }

}

export default PostgresStorage;