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
import { TSchema, defaultObjectKeyTypes } from '../../../server/schema';
import { PostgresDriver } from './driver';
import { SQL, SqlStorage, sql } from '../../../server/sql';
import { PostgresDialect } from './dialect';
import { Populate } from '../../../server/sql/compiler';
import { DecodedQuery, FindOptions } from '../../../server/storage';
import { FieldExpression, QuerySelector } from '../../../server/query/validator/parser';

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
    this.schedule?.execute();
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
        _created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        _updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
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

  protected _selectPopulate(
    parent: Pick<Populate, 'className' | 'name' | 'includes'> & { colname: string },
    populate: Populate,
    field: string,
  ): { column: SQL, join?: SQL } {
    const { name, className, type, foreignField } = populate;
    const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
    const _foreign = (field: string) => sql`${{ identifier: name }}.${{ identifier: field }}`;

    if (type === 'pointer') {
      return {
        column: sql`to_jsonb(${{ identifier: populate.name }}) AS ${{ identifier: field }}`,
        join: sql`
          LEFT JOIN ${{ identifier: populate.name }}
          ON ${sql`(${{ quote: className + '$' }} || ${_foreign('_id')})`} = ${_local(parent.colname)}
        `,
      };
    }

    let cond: SQL;
    if (_.isNil(foreignField)) {
      cond = sql`${sql`(${{ quote: className + '$' }} || ${_foreign('_id')})`} = ANY(${_local(parent.colname)})`;
    } else if (foreignField.type === 'pointer') {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(foreignField.colname)}`;
    } else {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(foreignField.colname)})`;
    }
    return {
      column: sql`
        ARRAY(
          SELECT to_jsonb(${{ identifier: populate.name }})
          FROM ${{ identifier: populate.name }} WHERE ${cond}
          ${!_.isEmpty(populate.sort) ? sql`ORDER BY ${this._decodeSort(populate.name, populate.sort)}` : sql``}
          ${populate.limit ? sql`LIMIT ${{ literal: `${populate.limit}` }}` : sql``}
          ${populate.skip ? sql`OFFSET ${{ literal: `${populate.skip}` }}` : sql``}
        ) AS ${{ identifier: field }}
      `,
    };
  }

  protected _decodePopulate(parent: Populate & { colname: string }): Record<string, SQL> {
    const _filter = this._decodeFilter(parent.className, parent.filter);
    const _populates = _.map(parent.populates, (populate, field) => this._selectPopulate(parent, populate, field));
    const _joins = _.compact(_.map(_populates, ({ join }) => join));
    return _.reduce(parent.populates, (acc, populate, field) => ({
      ...this._decodePopulate({ ...populate, colname: field }),
      ...acc,
    }), {
      [parent.name]: sql`
        SELECT
        ${{
          literal: [
            ...this._decodeIncludes(parent.name, parent.includes),
            ..._.map(_populates, ({ column }) => column),
          ], separator: ',\n'
        }}
        FROM ${{ identifier: parent.className }} AS ${{ identifier: parent.name }}
        ${!_.isEmpty(_joins) ? _joins : sql``}
        ${_filter ? sql`WHERE ${_filter}` : sql``}
      `,
    });
  }

  protected _decodeFieldExpression(className: string | null, field: string, expr: FieldExpression): SQL {
    const [colname, ...subpath] = _.toPath(field);
    const fields = className ? this.schema[className].fields : null;
    const type = fields?.[colname] ?? defaultObjectKeyTypes[colname];
    let element = sql`${{ identifier: className ? colname : '$' }}`;
    if (!className || !_.isEmpty(subpath)) {
      element = sql`jsonb_extract_path(${element}, ${_.map(
        className ? subpath : [colname, ...subpath], x => sql`${{ quote: x }}`
      )})`;
    }
    switch (expr.type) {
      case '$eq':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} ${this.dialect.nullSafeEqual()} ${this.dialect.encodeType(type, expr.value)}`;
      case '$gt':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} > ${this.dialect.encodeType(type, expr.value)}`;
      case '$gte':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} >= ${this.dialect.encodeType(type, expr.value)}`;
      case '$lt':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} < ${this.dialect.encodeType(type, expr.value)}`;
      case '$lte':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} <= ${this.dialect.encodeType(type, expr.value)}`;
      case '$ne':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        return sql`${element} ${this.dialect.nullSafeNotEqual()} ${this.dialect.encodeType(type, expr.value)}`;
      case '$in':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`${this.dialect.encodeValue(expr.value)} = ANY(${element})`;
        } else if (_.isArray(expr.value)) {
          return sql`${element} = ANY(${this.dialect.encodeValue(expr.value)})`;
        }
      case '$nin':
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`${this.dialect.encodeValue(expr.value)} <> ALL(${element})`;
        } else if (_.isArray(expr.value)) {
          return sql`${element} <> ALL(${this.dialect.encodeValue(expr.value)})`;
        }
      case '$subset':
        if (!_.isArray(expr.value)) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`${element} <@ ${this.dialect.encodeValue(expr.value)}`;
        }
      case '$superset':
        if (!_.isArray(expr.value)) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`${element} @> ${this.dialect.encodeValue(expr.value)}`;
        }
      case '$disjoint':
        if (!_.isArray(expr.value)) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`NOT ${element} && ${this.dialect.encodeValue(expr.value)}`;
        }
      case '$intersect':
        if (!_.isArray(expr.value)) break;
        if (type === 'array' || (!_.isString(type) && type?.type === 'array')) {
          return sql`${element} && ${this.dialect.encodeValue(expr.value)}`;
        }
      case '$not':
        if (!(expr.value instanceof FieldExpression)) break;
        return sql`NOT (${this._decodeFieldExpression(className, field, expr.value)})`;
      case '$pattern':
        if (_.isString(expr.value)) {
          return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
        } else if (_.isRegExp(expr.value)) {
          if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
          return sql`${element} ~ ${{ value: expr.value.source }}`;
        }
      case '$size':
        if (!_.isNumber(expr.value) || !_.isInteger(expr.value)) break;
        if (type === 'array' || (!_.isString(type) && type.type === 'relation')) {
          return sql`array_length(${element}, 1) = ${{ value: expr.value }}`;
        }
      case '$every':
        if (!(expr.value instanceof QuerySelector)) break;
        if (type === 'array' || (!_.isString(type) && type.type === 'relation')) {
          const filter = this._decodeFilter(null, expr.value);
          if (!filter) break;
          return sql`array_length(${element}, 1) = array_length(ARRAY(
              SELECT * FROM (SELECT unset(${element}) AS "$") "$"
              WHERE ${filter}
            ), 1)`;
        }
      case '$some':
        if (!(expr.value instanceof QuerySelector)) break;
        if (type === 'array' || (!_.isString(type) && type.type === 'relation')) {
          const filter = this._decodeFilter(null, expr.value);
          if (!filter) break;
          return sql`array_length(ARRAY(
              SELECT * FROM (SELECT unset(${element}) AS "$") "$"
              WHERE ${filter}
            ), 1) > 0`;
        }
      default: break;
    }
    throw Error('Invalid expression');
  }

  async explain(query: DecodedQuery<FindOptions>) {
    const compiler = this._queryCompiler(query);
    const explains = await this.query(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${this._selectQuery(query, compiler)}`);
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

}

export default PostgresStorage;