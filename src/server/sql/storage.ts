//
//  storage.ts
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
import { DecodedQuery, FindOptions, FindOneOptions, InsertOptions, TStorage } from '../storage';
import { TSchema, defaultObjectKeyTypes } from '../schema';
import { storageSchedule } from '../schedule';
import { PVK, TObject, TValue, UpdateOp, asyncStream } from '../../internals';
import { SQL, sql } from './sql';
import { SqlDialect } from './dialect';
import { Populate, QueryCompiler, QueryCompilerOptions } from './compiler';
import { generateId } from '../crypto';
import { CoditionalSelector, FieldExpression, FieldSelector, QuerySelector } from '../query/validator/parser';

export abstract class SqlStorage implements TStorage {

  schedule = storageSchedule(this, ['expireDocument']);
  schema: Record<string, TSchema> = {};

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
    this.schedule?.execute();
  }

  async shutdown() {
    this.schedule?.destory();
  }

  classes() {
    return Object.keys(this.schema);
  }

  abstract get dialect(): SqlDialect
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>
  protected abstract _encodeData(type: TSchema.Primitive, value: TValue): any
  protected abstract _decodeData(type: TSchema.Primitive, value: any): TValue

  query(sql: SQL) {
    const { query, values } = sql.compile(this.dialect);
    return this._query(query, values);
  }

  protected _queryCompiler(query: QueryCompilerOptions) {
    const compiler = new QueryCompiler(this.schema);
    compiler.compile(query);
    return compiler;
  }

  protected _encodeObjectAttrs(className: string, attrs: Record<string, TValue>): Record<string, any> {
    const fields = this.schema[className].fields;
    const result: Record<string, any> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      if (_.isString(dataType)) {
        result[key] = this._encodeData(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        result[key] = this._encodeData(dataType.type, value);
      } else if (dataType.type === 'pointer') {
        if (value instanceof TObject && value.objectId) result[key] = `${value.className}$${value.objectId}`;
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) result[key] = _.uniq(_.compact(value.map(x => x instanceof TObject && x.objectId ? `${x.className}$${x.objectId}` : undefined)));
      }
    }
    return result;
  }

  protected _decodeObject(className: string, attrs: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this._decodeData(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        obj[PVK].attributes[key] = this._decodeData(dataType.type, value);
      } else if (dataType.type === 'pointer') {
        if (_.isPlainObject(value)) obj[PVK].attributes[key] = this._decodeObject(dataType.target, value);
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x));
      }
    }
    return obj;
  }

  protected _decodeCoditionalSelector(className: string, filter: CoditionalSelector) {
    const queries = _.compact(_.map(filter.exprs, x => this._decodeFilter(className, x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }})`;
      case '$nor': return sql`(${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }})`;
      case '$or': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }})`;
    }
  }

  protected _decodeFieldExpression(className: string, field: string, expr: FieldExpression): any {
    const [colname, ...subpath] = _.toPath(field);



  }

  protected _decodeFilter(className: string, filter: QuerySelector): SQL | undefined {
    if (filter instanceof CoditionalSelector) {
      return this._decodeCoditionalSelector(className, filter);
    }
    if (filter instanceof FieldSelector) {
      return this._decodeFieldExpression(className, filter.field, filter.expr);
    }
  }

  protected _decodeIncludes(
    className: string,
    includes: Record<string, { type: TSchema.DataType; name: string; }>,
  ): SQL[] {
    const _includes = _.pickBy(includes, v => _.isString(v.type) || (v.type.type !== 'pointer' && v.type.type !== 'relation'));
    return _.map(_includes, ({ name }, colname) => sql`${{ identifier: className }}.${{ identifier: colname }} AS ${{ identifier: name }}`);
  }

  protected abstract _selectPopulate(
    parent: Pick<Populate, 'className' | 'name' | 'includes'> & { colname: string },
    populate: Populate,
    field: string,
  ): { column: SQL, join?: SQL }
  protected abstract _decodePopulate(parent: Populate & { colname: string }): Record<string, SQL>

  protected _selectQuery(query: DecodedQuery<FindOptions>, compiler: QueryCompiler, select?: SQL) {

    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const tempName = `_temp_$${query.className.toLowerCase()}`;

    const _filter = this._decodeFilter(query.className, query.filter);
    const _populates = _.map(compiler.populates, (populate, field) => this._selectPopulate({
      className: query.className,
      name: tempName,
      includes: compiler.includes,
      colname: field,
    }, populate, field));
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT
      ${select ? select : {
        literal: [
          ...this._decodeIncludes(tempName, compiler.includes),
          ..._.map(_populates, ({ column }) => column),
        ], separator: ',\n'
      }}
      FROM ${{ identifier: query.className }} AS ${{ identifier: tempName }}
      ${!_.isEmpty(_joins) ? _joins : sql``}
      ${_filter ? sql`WHERE ${_filter}` : sql``}
      ${query.limit ? sql`LIMIT ${{ literal: `${query.limit}` }}` : sql``}
      ${query.skip ? sql`OFFSET ${{ literal: `${query.skip}` }}` : sql``}
    `;
  }

  abstract explain(query: DecodedQuery<FindOptions>): PromiseLike<any>

  async count(query: DecodedQuery<FindOptions>) {
    const compiler = this._queryCompiler(query);
    const _query = await this.query(this._selectQuery(query, compiler, sql`COUNT(*) AS count`));
    return _.first(_query).count as number;
  }

  find(query: DecodedQuery<FindOptions>) {
    const compiler = this._queryCompiler(query);
    return this.query(this._selectQuery(query, compiler));
  }

  async insert(options: InsertOptions, attrs: Record<string, TValue>) {

    const _attrs: [string, TValue][] = _.toPairs({
      _id: generateId(options.objectIdSize),
      ...this._encodeObjectAttrs(options.className, attrs),
    });

    const compiler = this._queryCompiler({
      className: options.className,
      includes: options.includes,
      matches: options.matches,
    });
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const tempName = `_temp_$${options.className.toLowerCase()}`;

    const result = _.first(await this.query(sql`
      WITH ${{ identifier: tempName }} AS (
        INSERT INTO ${{ identifier: options.className }}
        (${_.map(_attrs, x => sql`${{ identifier: x[0] }}`)})
        VALUES (${_.map(_attrs, x => sql`${{ value: x[1] }}`)})
        RETURNING *
      )${!_.isEmpty(queries) ? sql`, ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT * FROM ${{ identifier: tempName }}
    `));

    return _.isNil(result) ? undefined : this._decodeObject(options.className, result);
  }

  protected _selectOneQuery(query: DecodedQuery<FindOneOptions>, compiler: QueryCompiler, action: (
    tempName: string,
    populates: {
      column: SQL;
      join?: SQL | undefined;
    }[]) => SQL) {

    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const tempName = `_temp_$${query.className.toLowerCase()}`;

    const _filter = this._decodeFilter(query.className, query.filter);
    const _populates = _.map(compiler.populates, (populate, field) => this._selectPopulate({
      className: query.className,
      name: tempName,
      includes: compiler.includes,
      colname: field,
    }, populate, field));
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    queries[tempName] = sql`
      SELECT
      ${{
        literal: [
          ...this._decodeIncludes(tempName, compiler.includes),
          ..._.map(_populates, ({ column }) => column),
        ], separator: ',\n'
      }}
      FROM ${{ identifier: query.className }} AS ${{ identifier: tempName }}
      ${!_.isEmpty(_joins) ? _joins : sql``}
      ${_filter ? sql`WHERE ${_filter}` : sql``}
      LIMIT 1
    `;

    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${action(tempName, _populates)}
    `;
  }

  async updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {

    const compiler = this._queryCompiler(query);
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    return undefined;
  }

  async replaceOne(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {

    const compiler = this._queryCompiler(query);
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    return undefined;
  }

  async upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {

    const _setOnInsert: [string, TValue][] = _.toPairs({
      _id: generateId(query.objectIdSize),
      ...this._encodeObjectAttrs(query.className, setOnInsert),
    });

    const compiler = this._queryCompiler(query);
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    return undefined;
  }

  async deleteOne(query: DecodedQuery<FindOneOptions>) {

    const compiler = this._queryCompiler(query);
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    return undefined;
  }

  async deleteMany(query: DecodedQuery<FindOptions>) {

    const compiler = this._queryCompiler(query);
    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    return 0;
  }

}
