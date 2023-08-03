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
import { Decimal, TObject, TValue } from '../../../internals';
import { TSchema } from '../../../server/schema';
import { PostgresDriver } from './driver';
import { SQL, SqlStorage, sql } from '../../../server/sql';
import { PostgresDialect } from './dialect';
import { Populate } from '../../../server/sql/compiler';

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
      case 'array': return 'JSONB[]';
      case 'pointer': return 'TEXT';
      case 'relation': return 'TEXT[]';
      default: throw Error('Unknown data type');
    }
  }

  private async _createTable(className: string, schema: TSchema) {
    const fields = _.pickBy(schema.fields, x => _.isString(x) || x.type !== 'relation' || _.isNil(x.foreignField));
    await this.query(sql`
      CREATE TABLE
      IF NOT EXISTS ${{ identifier: className }}
      (
        _id TEXT PRIMARY KEY,
        __v INTEGER NOT NULL DEFAULT 0,
        _created_at TIMESTAMP NOT NULL DEFAULT now(),
        _updated_at TIMESTAMP NOT NULL DEFAULT now(),
        _expired_at TIMESTAMP,
        _rperm TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        _wperm TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ${_.map(fields, (type, col) => sql`
          ${{ identifier: col }} ${{ literal: this._pgType(_.isString(type) ? type : type.type) }}
        `)}
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
      if (!_.isString(type) && type.type === 'relation' && !_.isNil(type.foreignField)) continue;
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
      const isAcl = _.isEqual(index.keys, { _rperm: 1 }) || _.isEqual(index.keys, { _wperm: 1 });
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

  _encodeData(type: TSchema.Primitive, value: TValue): any {
    return value;
  }

  _decodeData(type: TSchema.Primitive, value: any): TValue {
    switch (type) {
      case 'boolean':
        if (_.isBoolean(value)) return value;
        break;
      case 'number':
        if (_.isNumber(value)) return value;
        if (_.isString(value)) {
          const float = parseFloat(value);
          return _.isNaN(float) ? null : float;
        }
        break;
      case 'decimal':
        if (_.isString(value) || _.isNumber(value)) return new Decimal(value);
        if (value instanceof Decimal) return value;
        break;
      case 'string':
        if (_.isString(value)) return value;
        break;
      case 'date':
        if (_.isDate(value)) return value;
        break;
      case 'object':
        if (_.isPlainObject(value)) return value;
        break;
      case 'array':
        if (_.isArray(value)) return value;
        break;
      default: break;
    }
    return null;
  }

  protected _selectPopulate(
    parent: Pick<Populate, 'className' | 'name' | 'includes'> & { colname: string },
    populate: Populate,
    field: string,
  ): SQL {
    const { name, className, type, foreignField } = populate;
    let cond: SQL;
    if (type === 'pointer') {
      cond = sql`${{ identifier: parent.name }}.${{ identifier: parent.colname }} = ${sql`(${{ quote: className + '$' }} || ${{ identifier: name }}._id)`}`;
    } else if (_.isNil(foreignField)) {
      cond = sql`${{ identifier: parent.name }}.${{ identifier: parent.colname }} @> ARRAY[${sql`(${{ quote: className + '$' }} || ${{ identifier: name }}._id)`}]`;
    } else if (foreignField.type === 'pointer') {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${{ identifier: parent.name }}._id)`} = ${{ identifier: foreignField.colname }}`;
    } else {
      cond = sql`ARRAY[${sql`(${{ quote: parent.className + '$' }} || ${{ identifier: parent.name }}._id)`}] <@ ${{ identifier: foreignField.colname }}`;
    }
    return sql`ARRAY(SELECT row_to_json(SELECT * FROM ${{ identifier: populate.name }} WHERE ${cond})) AS ${{ identifier: parent.includes[field].name }}`;
  }

  protected _decodePopulate(parent: Populate & { colname: string }): Record<string, SQL> {
    const _filter = this._decodeFilter(parent.filter);
    return _.reduce(parent.populates, (acc, populate, field) => ({
      ...this._decodePopulate({ ...populate, colname: field }),
      ...acc,
    }), {
      [parent.name]: sql`
        SELECT
        ${{ literal: [
          ...this._decodeIncludes(parent.name, parent.includes),
          ..._.map(parent.populates, (populate, field) => this._selectPopulate(parent, populate, field)),
        ], separator: ',\n' }}
        FROM ${{ identifier: parent.className }} AS ${{ identifier: parent.name }}${_filter ? sql` WHERE ${_filter}` : sql``}
      `,
    });
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