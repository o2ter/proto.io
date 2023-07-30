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
import { TObject } from '../../../internals';
import { TSchema } from '../../../server/schema';
import { PostgresDriver } from './driver';
import { SqlStorage, sql } from '../../../server/sql';
import { PostgresDialect } from './dialect';

export class PostgresStorage extends SqlStorage {

  private _driver: PostgresDriver;

  constructor(config: string | PoolConfig) {
    super();
    this._driver = new PostgresDriver(config);
  }

  async shutdown() {
    await super.shutdown();
    await this._driver.shutdown();
  }

  async prepare(schema: Record<string, TSchema>) {
    await super.prepare(schema);
    for (const [className, _schema] of _.toPairs(schema)) {
      await this._createTable(className, _schema);
      await this._dropIndices(className, _schema);
      await this._rebuildColumns(className, _schema);
      await this._createIndices(className, _schema);
    }
  }

  private _pgType(type: TSchema.Primitive | TSchema.Relation) {
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
      default: throw Error('Unknown data type');
    }
  }

  private async _createTable(className: string, schema: TSchema) {
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: className }}
      (
        _id TEXT PRIMARY KEY,
        __v INTEGER NOT NULL DEFAULT 0,
        _created_at TIMESTAMP NOT NULL DEFAULT now(),
        _updated_at TIMESTAMP NOT NULL DEFAULT now(),
        _expired_at TIMESTAMP,
        _acl TEXT[],
        ${_.map(schema.fields, (type, col) => sql`
          ${{ identifier: col }} ${{ literal: this._pgType(_.isString(type) ? type : type.type) }}
        `)}
      )
    `);
  }

  private _indicesOf(schema: TSchema) {
    const relations = _.pickBy(schema.fields, v => !_.isString(v) && v.type === 'relation');
    return {
      relations,
      indexes: [
        ..._.map(_.keys(relations), k => ({ keys: { [k]: 1 } }) as TSchema.Indexes),
        ...(schema.indexes ?? []),
      ],
    };
  }

  private async _dropIndices(className: string, schema: TSchema) {
    const { indexes } = this._indicesOf(schema);
    const names: string[] = [];
    for (const index of indexes) {
      if (_.isEmpty(index.keys)) continue;
      names.push(`${className}$${_.map(index.keys, (v, k) => `${k}:${v}`).join('$')}`);
    }
    for (const [name, { is_primary }] of _.toPairs(await this.indices(className))) {
      if (is_primary || names.includes(name)) continue;
      await this.query(sql`DROP INDEX CONCURRENTLY IF EXISTS ${{ identifier: name }}`);
    }
  }

  private async _rebuildColumns(className: string, schema: TSchema) {
    const columns = await this.columns(className);
    const typeMap: Record<string, string> = {
      'timestamp without time zone': 'timestamp',
    };
    const rebuild: { name: string; type: string; }[] = [];
    for (const column of columns) {
      if (TObject.defaultKeys.includes(column.name)) continue;
      const type = schema.fields[column.name];
      const pgType = this._pgType(_.isString(type) ? type : type.type);
      if (pgType === typeMap[column.type] ?? column.type) continue;
      rebuild.push({ name: column.name, type: pgType });
    }
    if (_.isEmpty(rebuild)) return;
    await this.query(sql`
      ALTER TABLE ${{ identifier: className }}
      ${_.map(rebuild, ({ name, type }) => sql`
        DROP COLUMN IF EXISTS ${{ identifier: name }},
        ADD COLUMN ${{ identifier: name }} ${{ literal: type }}
      `)}
    `);
  }

  private async _createIndices(className: string, schema: TSchema) {
    const { relations, indexes } = this._indicesOf(schema);
    for (const index of indexes) {
      if (_.isEmpty(index.keys)) continue;
      const name = `${className}$${_.map(index.keys, (v, k) => `${k}:${v}`).join('$')}`;
      const isAcl = _.isEqual(index.keys, { _acl: 1 });
      const isRelation = _.has(relations, _.last(_.keys(index.keys)) as string);
      await this.query(sql`
        CREATE ${{ literal: index.unique ? 'UNIQUE' : '' }} INDEX CONCURRENTLY
        IF NOT EXISTS ${{ identifier: name }}
        ON ${{ identifier: className }}
        ${{ literal: isAcl || isRelation ? 'USING GIN' : '' }}
        (${_.map(index.keys, (v, k) => sql`
          ${{ identifier: k }} ${{ literal: isAcl || isRelation ? '' : v === 1 ? 'ASC' : 'DESC' }}
        `)})
      `);
    }
  }

  get dialect() {
    return PostgresDialect;
  }

  _query(text: string, values: any[] = [], batchSize?: number) {
    return this._driver.query(text, values, batchSize);
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

}

export default PostgresStorage;