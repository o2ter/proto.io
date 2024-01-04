//
//  pool.ts
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
import { PoolConfig } from 'pg';
import { TObject } from '../../../internals';
import { TSchema, isRelation } from '../../../internals/schema';
import { PostgresDriver, PostgresClientDriver } from './driver';
import { sql } from '../../../server/sql';
import { PostgresStorageClient } from './client';

export class PostgresStorage extends PostgresStorageClient<PostgresDriver> {

  constructor(config: string | PoolConfig) {
    super(new PostgresDriver(config));
  }

  async shutdown() {
    await super.shutdown();
    await this._driver.shutdown();
  }

  async prepare(schema: Record<string, TSchema>) {
    await super.prepare(schema);
    await this._createSystemTable();
    for (const [className, _schema] of _.toPairs(schema)) {
      await this._createTable(className, _schema);
      await this._dropIndices(className, _schema);
      await this._rebuildColumns(className, _schema);
      await this._createIndices(className, _schema);
    }
    this.schedule?.execute();
  }

  private _pgType(type: TSchema.Primitive | TSchema.Relation) {
    switch (type) {
      case 'boolean': return 'BOOLEAN';
      case 'number': return 'DOUBLE PRECISION';
      case 'decimal': return 'DECIMAL';
      case 'string': return 'TEXT';
      case 'date': return 'TIMESTAMP WITH TIME ZONE';
      case 'object': return 'JSONB';
      case 'array': return 'JSONB[]';
      case 'pointer': return 'TEXT';
      case 'relation': return 'TEXT[]';
      default: throw Error('Unknown data type');
    }
  }

  private async _createSystemTable() {
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: '_Config' }}
      (
        _id TEXT PRIMARY KEY,
        value JSONB
      )
    `);
  }

  private async _createTable(className: string, schema: TSchema) {
    const fields = _.pickBy(
      schema.fields, (x, k) => !_.includes(TObject.defaultKeys, k) && (!isRelation(x) || _.isNil(x.foreignField))
    );
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: className }}
      (
        _id TEXT PRIMARY KEY,
        __v INTEGER NOT NULL DEFAULT 0,
        _created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        _updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        _expired_at TIMESTAMP WITH TIME ZONE,
        _rperm TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
        _wperm TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[]
        ${_.isEmpty(fields) ? sql`` : sql`, ${_.map(fields, (dataType, col) => sql`
          ${{ identifier: col }} ${{ literal: this._pgType(_.isString(dataType) ? dataType : dataType.type) }}
        `)}`}
      )
    `);
    await this.query(sql`
      CREATE UNIQUE INDEX CONCURRENTLY
      IF NOT EXISTS ${{ identifier: `${className}$_id` }}
      ON ${{ identifier: className }}
      ((${{ quote: className + '$' }} || _id))
    `);
  }

  private _indicesOf(schema: TSchema) {
    const relations = _.pickBy(schema.fields, v => isRelation(v) && _.isNil(v.foreignField));
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
      names.push(`${className}$${index.unique ? 'u' : ''}$${_.map(index.keys, (v, k) => `${k}:${v}`).join('$')}`);
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
      'numeric': 'decimal',
    };
    const rebuild: { name: string; type: string; }[] = [];
    for (const column of columns) {
      if (TObject.defaultKeys.includes(column.name)) continue;
      const dataType = schema.fields[column.name];
      if (!_.isString(dataType) && dataType.type === 'relation' && !_.isNil(dataType.foreignField)) continue;
      const pgType = this._pgType(_.isString(dataType) ? dataType : dataType.type);
      if (pgType.toLowerCase() === (typeMap[column.type] ?? column.type)) continue;
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
      const isAcl = _.isEqual(index.keys, { _rperm: 1 }) || _.isEqual(index.keys, { _wperm: 1 });
      const isRelation = _.has(relations, _.last(_.keys(index.keys))!);
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

  override withConnection<T>(
    callback: (connection: PostgresStorageClient<PostgresClientDriver>) => PromiseLike<T>
  ) {
    return this._driver.withClient((client) => {
      const connection = new PostgresStorageClient(client, []);
      connection.schema = this.schema;
      return callback(connection);
    });
  }
}
