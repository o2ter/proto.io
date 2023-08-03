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
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions, InsertOptions, TStorage } from '../storage';
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

  private _queryCompiler(query: QueryCompilerOptions) {
    const compiler = new QueryCompiler(this.schema);
    compiler.compile(query);
    return compiler;
  }

  private _encodeObjectAttrs(className: string, attrs: Record<string, TValue>): Record<string, any> {
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

  private _decodeObject(className: string, attrs: Record<string, any>): TObject {
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

  private _decodeCoditionalSelector(filter: CoditionalSelector) {
    const queries = _.compact(_.map(filter.exprs, x => this._decodeFilter(x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }}`;
      case '$nor': return sql`${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }}`;
      case '$or': return sql`${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }}`;
    }
  }

  private _decodeFieldExpression(field: string, expr: FieldExpression) {

  }

  private _decodeFilter(filter: QuerySelector): SQL | undefined {
    if (filter instanceof CoditionalSelector) {
      return this._decodeCoditionalSelector(filter);
    }
    if (filter instanceof FieldSelector) {
      const [colname, ...subpath] = _.toPath(filter.field);

    }
  }

  private _decodePopulate(parentClass: string, parent: string, field: string, populate: Populate): SQL {
    const { name, className, type, foreignField, filter } = populate;
    const _filter = this._decodeFilter(filter);
    if (type === 'pointer') {
      return sql`${{ identifier: field }} IN (
        SELECT *
        FROM ${{ identifier: className }} AS ${{ identifier: name }}
        WHERE ${{ identifier: field }} = ${sql`(${{ quote: className + '$' }} || ${{ identifier: name }}._id)`}
          ${_filter ? sql`AND ${_filter}` : sql``}
      )`;
    } else if (_.isNil(foreignField)) {
      return sql`${{ identifier: field }} IN (
        SELECT *
        FROM ${{ identifier: className }} AS ${{ identifier: name }}
        WHERE ${{ identifier: field }} @> ARRAY[${sql`(${{ quote: className + '$' }} || ${{ identifier: name }}._id)`}]
          ${_filter ? sql`AND ${_filter}` : sql``}
      )`;
    } else if (foreignField.type === 'pointer') {
      return sql`${{ identifier: field }} IN (
        SELECT *
        FROM ${{ identifier: className }} AS ${{ identifier: name }}
        WHERE ${sql`(${{ quote: parentClass + '$' }} || ${{ identifier: parent }}._id)`} = ${{ identifier: foreignField.colname }}
          ${_filter ? sql`AND ${_filter}` : sql``}
      )`;
    } else {
      return sql`${{ identifier: field }} IN (
        SELECT *
        FROM ${{ identifier: className }} AS ${{ identifier: name }}
        WHERE ARRAY[${sql`(${{ quote: parentClass + '$' }} || ${{ identifier: parent }}._id)`}] <@ ${{ identifier: foreignField.colname }}
          ${_filter ? sql`AND ${_filter}` : sql``}
      )`;
    }
  }

  private _decodeSubquery(query: {
    name?: string;
    className: string;
    includes: Record<string, { name: string; }>;
    populates: Record<string, Populate>;
  }): Record<string, SQL> {
    const populates = _.mapValues(query.populates, v => ({
      ...v,
      populate: this._decodeSubquery(v),
    }));
    const filter = _.map(populates, (populate, field) => this._decodePopulate(
      query.className,
      query.name ?? query.className,
      query.includes[field]?.name ?? field,
      populate
    ));
    return _.reduce(_.values(populates), (acc, { populate }) => ({
      ...populate,
      ...acc,
    }), query.name ? {
      [query.name]: sql`
        SELECT * FROM ${{ identifier: query.className }}
        ${filter ? sql`WHERE ${{ literal: filter, separator: ' AND ' }}` : sql``}
      `} : {});
  }

  async explain(query: DecodedQuery<ExplainOptions>) {

    const compiler = this._queryCompiler(query);

    console.dir(compiler, { depth: null })
    console.log(_.mapValues(this._decodeSubquery({
      className: query.className,
      includes: compiler.includes,
      populates: compiler.populates,
    }), sql => sql.toString()))

    return 0;
  }

  async count(query: DecodedQuery<FindOptions>) {

    const compiler = this._queryCompiler(query);

    return 0;
  }

  async* find(query: DecodedQuery<FindOptions>) {

    const compiler = this._queryCompiler(query);

    return [];
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

    const tempName = `_temp_${options.className.toLowerCase()}`;

    const result = _.first(await this.query(sql`
      WITH ${{ identifier: tempName }} AS (
        INSERT INTO ${{ identifier: options.className }}
        (${_.map(_attrs, x => sql`${{ identifier: x[0] }}`)})
        VALUES (${_.map(_attrs, x => sql`${{ value: x[1] }}`)})
        RETURNING *
      )
      SELECT * FROM ${{ identifier: tempName }}
    `));

    return _.isNil(result) ? undefined : this._decodeObject(options.className, result);
  }

  async updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {

    const compiler = this._queryCompiler(query);

    return undefined;
  }

  async replaceOne(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {

    const compiler = this._queryCompiler(query);

    return undefined;
  }

  async upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {

    const _setOnInsert: [string, TValue][] = _.toPairs({
      _id: generateId(query.objectIdSize),
      ...this._encodeObjectAttrs(query.className, setOnInsert),
    });

    const compiler = this._queryCompiler(query);

    return undefined;
  }

  async deleteOne(query: DecodedQuery<FindOneOptions>) {

    const compiler = this._queryCompiler(query);

    return undefined;
  }

  async deleteMany(query: DecodedQuery<FindOptions>) {

    const compiler = this._queryCompiler(query);

    return 0;
  }

}
