//
//  pool.ts
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
import { PoolConfig } from 'pg';
import { TSchema, _isTypeof, isPointer, isPrimitive, isRelation, isShape, isVector, shapePaths } from '../../../../internals/schema';
import { PostgresDriver, PostgresClientDriver } from '../driver';
import { sql } from '../../sql';
import { PostgresStorageClient } from './base';
import { TObject } from '../../../../internals/object';

const resolveDataType = (
  schema: TSchema,
  path: string,
) => {
  let fields = schema.fields;
  let last;
  for (const key of _.toPath(path)) {
    const dataType = fields[key];
    if (_.isNil(dataType)) throw Error(`Invalid path: ${path}`);
    if (isPrimitive(dataType) || isVector(dataType)) return dataType;
    if (!isShape(dataType)) return dataType;
    fields = dataType.shape;
  }
  return last;
}

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
    await this._enableExtensions();
    await this._createSystemTable();
    for (const [className, _schema] of _.toPairs(schema)) {
      await this._createTable(className, _schema);
      await this._dropIndices(className, _schema);
      await this._rebuildColumns(className, _schema);
      await this._createIndices(className, _schema);
    }
  }

  private _pgType(type: TSchema.Primitive | 'pointer' | 'relation' | 'vector') {
    switch (type) {
      case 'boolean': return 'BOOLEAN';
      case 'number': return 'DOUBLE PRECISION';
      case 'decimal': return 'DECIMAL';
      case 'string': return 'TEXT';
      case 'string[]': return 'TEXT[]';
      case 'date': return 'TIMESTAMP(3) WITH TIME ZONE';
      case 'object': return 'JSONB';
      case 'array': return 'JSONB[]';
      case 'vector': return 'DOUBLE PRECISION[]';
      case 'pointer': return 'TEXT';
      case 'relation': return 'TEXT[]';
      default: throw Error('Unknown data type');
    }
  }

  private async _enableExtensions() {
    const found = await this.query(sql`SELECT * FROM pg_available_extensions WHERE name = 'vector'`);
    if (!_.isEmpty(found)) {
      await this.query(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    }
  }

  private async _createSystemTable() {
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: '_Config' }}
      (
        _id TEXT PRIMARY KEY,
        _rperm TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
        value JSONB
      )
    `);
  }

  private _fields(schema: TSchema) {
    const fields: Record<string, Exclude<TSchema.DataType, TSchema.ShapeType>> = {};
    for (const [key, dataType] of _.entries(schema.fields)) {
      if (isShape(dataType)) {
        for (const { path, type } of shapePaths(dataType)) {
          fields[`${key}.${path}`] = type;
        }
      } else {
        fields[key] = dataType;
      }
    }
    return fields;
  }

  private async _createTable(className: string, schema: TSchema) {
    const fields = _.pickBy(
      this._fields(schema), (x, k) => !_.includes(TObject.defaultKeys, k) && (!isRelation(x) || _.isNil(x.foreignField))
    );
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: className }}
      (
        _id TEXT PRIMARY KEY,
        __v INTEGER NOT NULL DEFAULT 0,
        __i BIGSERIAL NOT NULL UNIQUE,
        _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT NOW(),
        _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT NOW(),
        _expired_at TIMESTAMP(3) WITH TIME ZONE,
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
    const fields = this._fields(schema);
    const pointers = _.pickBy(fields, v => isPointer(v));
    const relations = _.pickBy(fields, v => isRelation(v) && _.isNil(v.foreignField));
    return {
      relations,
      indexes: [
        ..._.map(_.keys(pointers), k => ({ keys: { [k]: 1 } }) as TSchema.Indexes),
        ..._.map(_.keys(relations), k => ({ keys: { [k]: 1 } }) as TSchema.Indexes),
        ...(schema.indexes ?? []),
      ],
    };
  }

  private _indexBasicName(className: string, keys: Record<string, 1 | -1>, unique: boolean) {
    if (unique) return `${className}$u$${_.map(keys, (v, k) => `${k}:${v}`).join('$')}`;
    return `${className}$b$${_.map(keys, (v, k) => `${k}:${v}`).join('$')}`;
  }

  private _indexVectorName(className: string, keys: string[]) {
    return {
      'vector_l1_ops': `${className}$v1$${keys.join('$')}`,
      'vector_l2_ops': `${className}$v2$${keys.join('$')}`,
      'vector_ip_ops': `${className}$vi$${keys.join('$')}`,
      'vector_cosine_ops': `${className}$vc$${keys.join('$')}`,
    };
  }

  private async _dropIndices(className: string, schema: TSchema) {
    const { indexes } = this._indicesOf(schema);
    const names: string[] = [];
    for (const index of indexes) {
      if (_.isEmpty(index.keys)) continue;
      switch (index.type) {
        case 'vector':
          names.push(..._.values(this._indexVectorName(className, _.castArray(index.keys))));
          break;
        default:
          names.push(this._indexBasicName(className, index.keys, !!index.unique));
          break;
      }
    }
    for (const [name, { is_primary }] of _.toPairs(await this.indices(className))) {
      if (is_primary || names.includes(name)) continue;
      if (name.endsWith('__i_key')) continue;
      await this.query(sql`DROP INDEX CONCURRENTLY IF EXISTS ${{ identifier: name }}`);
    }
  }

  private async _rebuildColumns(className: string, schema: TSchema) {
    const columns = await this.columns(className);
    const typeMap: Record<string, string> = {
      'timestamp': 'timestamp(3) without time zone',
      'numeric': 'decimal',
    };
    const fields = this._fields(schema);
    const rebuild: { name: string; type: string; }[] = [];
    for (const column of columns) {
      if (TObject.defaultKeys.includes(column.name)) continue;
      const dataType = fields[column.name];
      if (!dataType) continue;
      if (!_.isString(dataType) && dataType.type === 'relation' && !_.isNil(dataType.foreignField)) continue;
      const pgType = this._pgType(_.isString(dataType) ? dataType : dataType.type);
      if (pgType.toLowerCase() === (typeMap[column.type] ?? column.type)) continue;
      rebuild.push({ name: column.name, type: pgType });
    }
    for (const column of _.difference(_.keys(fields), _.map(columns, x => x.name))) {
      const dataType = fields[column];
      const pgType = this._pgType(_.isString(dataType) ? dataType : dataType.type);
      rebuild.push({ name: column, type: pgType });
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
      switch (index.type) {
        case 'vector':
          {
            const name = this._indexVectorName(className, _.castArray(index.keys));
            const ops = _.keys(name) as (keyof typeof name)[];
            const method = index.method ?? 'hnsw';
            if (_.isArray(index.keys)) {
              for (const op of ops) {
                await this.query(sql`
                  CREATE INDEX CONCURRENTLY
                  IF NOT EXISTS ${{ identifier: name[op] }}
                  ON ${{ identifier: className }}
                  USING ${{ literal: method }} (
                    CAST(
                      ARRAY[${_.map(index.keys, k => sql`COALESCE(${{ identifier: k }}, 0)`)}]
                      AS VECTOR(${{ literal: `${index.keys.length}` }})
                    ) ${{ literal: op }}
                  )
                `);
              }
            } else {
              const column = index.keys;
              const dataType = schema.fields[column];
              if (!isVector(dataType)) throw Error('Invalid index type');
              for (const op of ops) {
                await this.query(sql`
                  CREATE INDEX CONCURRENTLY
                  IF NOT EXISTS ${{ identifier: name[op] }}
                  ON ${{ identifier: className }}
                  USING ${{ literal: method }} (
                    CAST(
                      ${{ identifier: column }} AS VECTOR(${{ literal: `${dataType.dimension}` }})
                    ) ${{ literal: op }}
                  )
                `);
              }
            }
          }
          break;
        default:
          {
            const name = this._indexBasicName(className, index.keys, !!index.unique);
            const useGin = _.some(_.keys(index.keys), column => {
              const dataType = resolveDataType(schema, column);
              if (!dataType || isShape(dataType)) throw Error('Invalid index type');
              return _isTypeof(dataType, 'string[]') || _.has(relations, column);
            });
            await this.query(sql`
              CREATE ${{ literal: index.unique ? 'UNIQUE' : '' }} INDEX CONCURRENTLY
              IF NOT EXISTS ${{ identifier: name }}
              ON ${{ identifier: className }}
              ${{ literal: useGin ? 'USING GIN' : '' }}
              (${_.map(index.keys, (v, k) => sql`
                ${{ identifier: k }} ${{ literal: useGin ? '' : v === 1 ? 'ASC' : 'DESC' }}
              `)})
            `);
          }
          break;
      }
    }
  }

  override withConnection<T>(
    callback: (connection: PostgresStorageClient<PostgresClientDriver>) => PromiseLike<T>
  ) {
    return this._driver.withClient((client) => {
      const connection = new PostgresStorageClient(client);
      connection.schema = this.schema;
      return callback(connection);
    });
  }
}
