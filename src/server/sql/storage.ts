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
  }

  async shutdown() {
    this.schedule?.destory();
  }

  classes() {
    return Object.keys(this.schema);
  }

  abstract get dialect(): SqlDialect
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>
  protected abstract _decodeFieldExpression(parent: { className?: string; name: string; }, field: string, expr: FieldExpression): SQL

  query(sql: SQL) {
    const { query, values } = sql.compile(this.dialect);
    return this._query(query, values);
  }

  protected _queryCompiler(query: QueryCompilerOptions) {
    const compiler = new QueryCompiler(this.schema);
    compiler.compile(query);
    return compiler;
  }

  protected _encodeObjectAttrs(className: string, attrs: Record<string, TValue>): Record<string, SQL> {
    const fields = this.schema[className].fields;
    const result: Record<string, SQL> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      result[key] = this.dialect.encodeType(dataType, value);
    }
    return result;
  }

  protected _decodeObject(className: string, attrs: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType.type, value) ?? dataType.default as any;
      } else if (dataType.type === 'pointer') {
        if (_.isPlainObject(value)) obj[PVK].attributes[key] = this._decodeObject(dataType.target, value);
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x));
      }
    }
    return obj;
  }

  protected _decodeCoditionalSelector(parent: { className?: string; name: string; }, filter: CoditionalSelector) {
    const queries = _.compact(_.map(filter.exprs, x => this._decodeFilter(parent, x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }})`;
      case '$nor': return sql`(${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }})`;
      case '$or': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }})`;
    }
  }

  protected _decodeFilter(parent: { className?: string; name: string; }, filter: QuerySelector): SQL | undefined {
    if (filter instanceof CoditionalSelector) {
      return this._decodeCoditionalSelector(parent, filter);
    }
    if (filter instanceof FieldSelector) {
      return this._decodeFieldExpression(parent, filter.field, filter.expr);
    }
  }

  protected _decodeIncludes(
    className: string,
    includes: Record<string, TSchema.DataType>,
  ): SQL[] {
    const _includes = _.pickBy(includes, v => _.isString(v) || (v.type !== 'pointer' && v.type !== 'relation'));
    return _.map(_.keys(_includes), (colname) => sql`${{ identifier: className }}.${{ identifier: colname }}`);
  }

  protected abstract _selectPopulate(
    parent: Pick<Populate, 'className' | 'name' | 'includes'> & { colname: string },
    populate: Populate,
    field: string,
  ): { column: SQL, join?: SQL }
  protected abstract _decodePopulate(parent: Populate & { colname: string }, remix?: { className: string; name: string; }): Record<string, SQL>

  protected abstract _decodeSortKey(className: string, key: string): SQL
  protected _decodeSort(className: string, sort: Record<string, 1 | -1>): SQL {
    return sql`${_.map(sort, (order, key) => sql`
      ${this._decodeSortKey(className, key)} ${{ literal: order === 1 ? 'ASC' : 'DESC' }}
    `)}`;
  }

  protected _selectPopulateMap(
    className: string,
    name: string,
    compiler: {
      includes: Record<string, TSchema.DataType>;
      populates: Record<string, Populate>;
    },
  ) {
    return _.map(compiler.populates, (populate, field) => this._selectPopulate({
      className,
      name,
      includes: compiler.includes,
      colname: field,
    }, populate, field));
  }

  protected _baseSelectQuery(
    query: DecodedQuery<FindOptions>,
    compiler: QueryCompiler,
    select?: SQL
  ) {

    const populates = _.mapValues(compiler.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const fetchName = `_fetch_$${query.className.toLowerCase()}`;

    const _filter = this._decodeFilter({ className: query.className, name: fetchName }, query.filter);
    const _populates = this._selectPopulateMap(query.className, fetchName, compiler);
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    const _includes = select ? select : {
      literal: [
        ...this._decodeIncludes(fetchName, compiler.includes),
        ..._.map(_populates, ({ column }) => column),
      ], separator: ',\n'
    };

    return {
      queries,
      fetchName,
      query: sql`
        SELECT * FROM (
          SELECT ${_includes}
          FROM ${{ identifier: query.className }} AS ${{ identifier: fetchName }}
          ${!_.isEmpty(_joins) ? _joins : sql``}
        ) AS ${{ identifier: fetchName }}
        ${_filter ? sql`WHERE ${_filter}` : sql``}
        ${!_.isEmpty(query.sort) ? sql`ORDER BY ${this._decodeSort(fetchName, query.sort)}` : sql``}
        ${query.limit ? sql`LIMIT ${{ literal: `${query.limit}` }}` : sql``}
        ${query.skip ? sql`OFFSET ${{ literal: `${query.skip}` }}` : sql``}
      `,
    };
  }

  protected _selectQuery(query: DecodedQuery<FindOptions>, compiler: QueryCompiler, select?: SQL) {
    const { queries, query: _query } = this._baseSelectQuery(query, compiler, select);
    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${_query}
    `;
  }

  protected _refetch(name: string, query: DecodedQuery<FindOneOptions>, compiler: QueryCompiler) {

    const recompiled = compiler._decodeIncludes(query.className, query.includes, query.matches);
    const populates = _.mapValues(
      recompiled.populates, (populate, field) => this._decodePopulate({ ...populate, colname: field }, { className: query.className, name })
    );
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const _populates = this._selectPopulateMap(query.className, name, recompiled);
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    const _includes = {
      literal: [
        ...this._decodeIncludes(name, recompiled.includes),
        ..._.map(_populates, ({ column }) => column),
      ], separator: ',\n'
    };

    return sql`
      ${!_.isEmpty(queries) ? sql`, ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT ${_includes}
      FROM ${{ identifier: name }}
      ${!_.isEmpty(_joins) ? _joins : sql``}
    `;
  }

  protected _modifyQuery(
    query: DecodedQuery<FindOneOptions> & { limit?: number },
    compiler: QueryCompiler,
    action: (fetchName: string) => SQL
  ) {
    const { queries, fetchName, query: _query } = this._baseSelectQuery(query, compiler);
    queries[fetchName] = _query;
    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${action(fetchName)}
    `;
  }

  abstract explain(query: DecodedQuery<FindOptions>): PromiseLike<any>

  async count(query: DecodedQuery<FindOptions>) {
    const compiler = this._queryCompiler(query);
    const result = await this.query(this._selectQuery(query, compiler, sql`COUNT(*) AS count`));
    return _.first(result).count as number;
  }

  find(query: DecodedQuery<FindOptions>) {
    const self = this;
    return asyncStream(async function* () {
      const compiler = self._queryCompiler(query);
      const objects = self.query(self._selectQuery(query, compiler));
      for await (const object of objects) {
        yield self._decodeObject(query.className, object);
      }
    });
  }

  private _defaultInsertOpts(options: InsertOptions) {
    const objectId = generateId(options.objectIdSize);
    return {
      _id: sql`${{ value: objectId }}`,
      ...options.className === '_User' ? {
        _rperm: sql`${{ value: [objectId] }}`,
        _wperm: sql`${{ value: [objectId] }}`,
      } : {},
    };
  }

  async insert(options: InsertOptions, attrs: Record<string, TValue>) {

    const _attrs: [string, SQL][] = _.toPairs({
      ...this._defaultInsertOpts(options),
      ...this._encodeObjectAttrs(options.className, attrs),
    });

    const compiler = this._queryCompiler({
      className: options.className,
      includes: options.includes,
      matches: options.matches,
    });

    const name = `_insert_$${options.className.toLowerCase()}`;

    const populates = this._selectPopulateMap(options.className, name, compiler);
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));
    const joins = _.compact(_.map(populates, ({ join }) => join));

    const result = _.first(await this.query(sql`
      WITH ${{ identifier: name }} AS (
        INSERT INTO ${{ identifier: options.className }}
        (${_.map(_attrs, x => sql`${{ identifier: x[0] }}`)})
        VALUES (${_.map(_attrs, x => sql`${x[1]}`)})
        RETURNING *
      )${!_.isEmpty(queries) ? sql`, ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT ${{
        literal: [
          ...this._decodeIncludes(name, compiler.includes),
          ..._.map(populates, ({ column }) => column),
        ], separator: ',\n'
      }}
      FROM ${{ identifier: name }}
      ${!_.isEmpty(joins) ? joins : sql``}
    `));

    return _.isNil(result) ? undefined : this._decodeObject(options.className, result);
  }

  protected _encodeUpdateAttrs(className: string, attrs: Record<string, [UpdateOp, TValue]>): SQL[] {
    const updates: SQL[] = [];
    const fields = this.schema[className].fields;
    for (const [path, op] of _.toPairs(attrs)) {
      const [colname] = _.toPath(path);
      updates.push(sql`${{ identifier: colname }} = ${this.dialect.updateOperation(
        path, fields[colname] ?? defaultObjectKeyTypes[colname], op
      )}`);
    }
    return updates;
  }

  async updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    const compiler = this._queryCompiler(query);
    const updated = _.first(await this.query(this._modifyQuery(
      { ...query, limit: 1 },
      compiler,
      (fetchName) => {
        const name = `_update_$${query.className.toLowerCase()}`;
        return sql`
          , ${{ identifier: name }} AS (
            UPDATE ${{ identifier: query.className }}
            SET __v = __v + 1, _updated_at = NOW()
            ${!_.isEmpty(update) ? sql`, ${this._encodeUpdateAttrs(query.className, update)}` : sql``}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          ${this._refetch(name, query, compiler)}
        `;
      }
    )));
    return _.isNil(updated) ? undefined : this._decodeObject(query.className, updated);
  }

  async upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    const compiler = this._queryCompiler(query);
    const _insert: [string, SQL][] = _.toPairs({
      ...this._defaultInsertOpts(query),
      ...this._encodeObjectAttrs(query.className, setOnInsert),
    });
    const upserted = _.first(await this.query(this._modifyQuery(
      { ...query, limit: 1 },
      compiler,
      (fetchName) => {
        const updateName = `_update_$${query.className.toLowerCase()}`;
        const insertName = `_insert_$${query.className.toLowerCase()}`;
        const upsertName = `_upsert_$${query.className.toLowerCase()}`;
        return sql`
          , ${{ identifier: updateName }} AS (
            UPDATE ${{ identifier: query.className }}
            SET __v = __v + 1, _updated_at = NOW()
            ${!_.isEmpty(update) ? sql`, ${this._encodeUpdateAttrs(query.className, update)}` : sql``}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          , ${{ identifier: insertName }} AS (
            INSERT INTO ${{ identifier: query.className }}
            (${_.map(_insert, x => sql`${{ identifier: x[0] }}`)})
            SELECT ${_.map(_insert, x => sql`${x[1]} AS ${{ identifier: x[0] }}`)}
            WHERE NOT EXISTS(SELECT * FROM ${{ identifier: updateName }})
            RETURNING *
          )
          , ${{ identifier: upsertName }} AS (
            SELECT * FROM ${{ identifier: updateName }}
            UNION
            SELECT * FROM ${{ identifier: insertName }}
          )
          ${this._refetch(upsertName, query, compiler)}
        `;
      }
    )));
    return _.isNil(upserted) ? undefined : this._decodeObject(query.className, upserted);
  }

  async deleteOne(query: DecodedQuery<FindOneOptions>) {
    const compiler = this._queryCompiler(query);
    const deleted = _.first(await this.query(this._modifyQuery(
      { ...query, limit: 1 },
      compiler,
      (fetchName) => {
        const name = `_delete_$${query.className.toLowerCase()}`;
        const populates = this._selectPopulateMap(query.className, name, compiler);
        const joins = _.compact(_.map(populates, ({ join }) => join));
        return sql`
          , ${{ identifier: name }} AS (
            DELETE FROM ${{ identifier: query.className }}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          SELECT ${{
            literal: [
              ...this._decodeIncludes(name, compiler.includes),
              ..._.map(populates, ({ column }) => column),
            ], separator: ',\n'
          }}
          FROM ${{ identifier: name }}
          ${!_.isEmpty(joins) ? joins : sql``}
        `;
      }
    )));
    return _.isNil(deleted) ? undefined : this._decodeObject(query.className, deleted);
  }

  async deleteMany(query: DecodedQuery<FindOptions>) {
    const compiler = this._queryCompiler(query);
    const deleted = await this.query(this._modifyQuery(
      query,
      compiler,
      (fetchName) => sql`
        DELETE FROM ${{ identifier: query.className }}
        WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
        RETURNING 0
      `
    ));
    return deleted.length;
  }

}
