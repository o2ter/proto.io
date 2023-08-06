//
//  compiler.ts
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
import { TSchema, isPointer, isRelation } from '../schema';
import { defaultObjectKeyTypes } from '../schema';
import { CoditionalSelector, FieldSelector, QuerySelector } from '../query/validator/parser';
import { DecodedBaseQuery, DecodedQuery, FindOneOptions, FindOptions, InsertOptions } from '../storage';
import { SQL, sql } from './sql';
import { TValue, UpdateOp } from '../../internals';
import { generateId } from '../crypto';
import { SqlDialect } from './dialect';

export type QueryCompilerOptions = {
  className: string;
  filter?: QuerySelector;
  sort?: Record<string, 1 | -1>;
  includes: string[];
  matches: Record<string, DecodedBaseQuery>;
}

export type Populate = {
  name: string;
  className: string;
  type: TSchema.Relation;
  foreignField?: { colname: string; type: TSchema.Relation; };
  subpaths: string[];
  filter: QuerySelector;
  includes: Record<string, TSchema.DataType>;
  populates: Record<string, Populate>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
}

export type CompileContext = {
  includes: Record<string, TSchema.DataType>;
  populates: Record<string, Populate>;
  sorting?: Record<string, 1 | -1>;
}

export class QueryCompiler {

  schema: Record<string, TSchema>;
  dialect: SqlDialect;

  idx = 0;
  stages: Record<string, SQL> = {};

  constructor(schema: Record<string, TSchema>, dialect: SqlDialect) {
    this.schema = schema;
    this.dialect = dialect;
  }

  nextIdx() {
    return this.idx++;
  }

  private _makeContext(query: InsertOptions & { sort?: Record<string, 1 | -1> }) {
    const context = this._decodeIncludes(query.className, query.includes, query.matches);
    return {
      ...context,
      sorting: this._decodeSorting(context.includes, context.populates, query.sort),
    };
  }

  private _decodeIncludes(className: string, includes: string[], matches: Record<string, DecodedBaseQuery>) {

    const schema = this.schema[className] ?? {};
    const names: Record<string, TSchema.DataType> = {};
    const populates: Record<string, Populate> = {};

    for (const include of includes) {
      const [colname, ...subpath] = include.split('.');

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      names[colname] = dataType;

      if (isPointer(dataType) || isRelation(dataType)) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        const _matches = matches[colname];
        populates[colname] = populates[colname] ?? {
          name: `t${this.nextIdx()}`,
          className: dataType.target,
          subpaths: [],
          matches: _matches.filter,
          skip: _matches.skip,
          limit: _matches.limit,
          type: dataType.type,
        };
        if (isRelation(dataType) && dataType.foreignField) {
          const targetType = this.schema[dataType.target].fields[dataType.foreignField];
          if (!isPointer(targetType) && !isRelation(targetType)) throw Error(`Invalid path: ${include}`);
          populates[colname].foreignField = {
            colname: dataType.foreignField,
            type: targetType.type,
          };
        }
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const [colname, populate] of _.toPairs(populates)) {
      const _matches = matches[colname];
      const { includes, populates } = this._decodeIncludes(populate.className, populate.subpaths, _matches.matches);
      populate.sort = this._decodeSorting(includes, populates, _matches.sort);
      populate.includes = includes;
      populate.populates = populates;
    }

    return { includes: names, populates };
  }

  private _resolveSortingName(
    key: string,
    includes: Record<string, TSchema.DataType>,
    populates: Record<string, Populate>,
  ) {
    let resolved: string | undefined;
    let resolvedField = false;
    for (const colname of _.toPath(key)) {
      const name = resolved ? `${resolved}.${colname}` : colname;
      if (resolvedField || includes[name]) {
        resolved = name;
        resolvedField = true;
      } else if (populates[name]) {
        resolved = populates[name].name;
        includes = populates[name].includes;
        populates = populates[name].populates;
      } else {
        throw Error(`Invalid path: ${key}`);
      }
    }
    return resolved;
  }

  private _decodeSorting(
    includes: Record<string, TSchema.DataType>,
    populates: Record<string, Populate>,
    sort?: Record<string, 1 | -1>,
  ) {
    const sorting: Record<string, 1 | -1> = {};
    for (const [key, order] of _.toPairs(sort)) {
      const resolved = this._resolveSortingName(key, includes, populates);
      if (!resolved) throw Error(`Invalid path: ${key}`);
      sorting[resolved] = order;
    }
    return sorting;
  }

  _selectQuery(
    query: DecodedQuery<FindOptions>,
    context?: CompileContext,
    select?: SQL
  ) {
    const { queries, query: _query } = this._baseSelectQuery(query, context, select);
    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${_query}
    `;
  }

  private _baseSelectQuery(
    query: DecodedQuery<FindOptions>,
    context?: CompileContext,
    select?: SQL
  ) {

    const _context = context ?? this._makeContext(query);
    const populates = _.mapValues(_context.populates, (populate, field) => this.dialect.decodePopulate(this, _context, { ...populate, colname: field }));
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const fetchName = `_fetch_$${query.className.toLowerCase()}`;

    const _filter = this._decodeFilter(_context, { className: query.className, name: fetchName }, query.filter);
    const _populates = this._selectPopulateMap(_context, query.className, fetchName);
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    const _includes = select ? select : {
      literal: [
        ...this._selectIncludes(fetchName, _context.includes),
        ..._.map(_populates, ({ column }) => column),
      ], separator: ',\n'
    };

    return {
      queries,
      fetchName,
      context: _context,
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

  private _refetch(
    name: string,
    query: DecodedQuery<FindOneOptions>,
    context: CompileContext,
  ) {

    const _context = this._decodeIncludes(query.className, query.includes, query.matches);
    const populates = _.mapValues(
      _context.populates, (populate, field) => this.dialect.decodePopulate(this, context, { ...populate, colname: field }, { className: query.className, name })
    );
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const _populates = this._selectPopulateMap(_context, query.className, name);
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    const _includes = {
      literal: [
        ...this._selectIncludes(name, _context.includes),
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

  private _modifyQuery(
    query: DecodedQuery<FindOneOptions> & { limit?: number },
    action: (fetchName: string, context: CompileContext) => SQL
  ) {
    const { queries, fetchName, query: _query, context } = this._baseSelectQuery(query);
    queries[fetchName] = _query;
    return sql`
      ${!_.isEmpty(queries) ? sql`WITH ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${action(fetchName, context)}
    `;
  }

  private _encodeUpdateAttrs(className: string, attrs: Record<string, [UpdateOp, TValue]>): SQL[] {
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

  private _encodeObjectAttrs(className: string, attrs: Record<string, TValue>
  ): Record<string, SQL> {
    const fields = this.schema[className].fields;
    const result: Record<string, SQL> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      result[key] = this.dialect.encodeType(dataType, value);
    }
    return result;
  }

  private _decodeCoditionalSelector(
    parent: { className?: string; name: string; },
    filter: CoditionalSelector,
    context: CompileContext,
  ) {
    const queries = _.compact(_.map(filter.exprs, x => this._decodeFilter(context, parent, x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }})`;
      case '$nor': return sql`(${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }})`;
      case '$or': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }})`;
    }
  }

  _decodeFilter(
    context: CompileContext,
    parent: { className?: string; name: string; },
    filter: QuerySelector,
  ): SQL | undefined {
    if (filter instanceof CoditionalSelector) {
      return this._decodeCoditionalSelector(parent, filter, context);
    }
    if (filter instanceof FieldSelector) {
      return this.dialect.decodeFieldExpression(this, context, parent, filter.field, filter.expr);
    }
  }

  private _selectIncludes(
    className: string,
    includes: Record<string, TSchema.DataType>,
  ): SQL[] {
    const _includes = _.pickBy(includes, v => _.isString(v) || (v.type !== 'pointer' && v.type !== 'relation'));
    return _.map(_.keys(_includes), (colname) => sql`${{ identifier: className }}.${{ identifier: colname }}`);
  }

  _decodeSort(className: string, sort: Record<string, 1 | -1>): SQL {
    return sql`${_.map(sort, (order, key) => sql`
      ${this.dialect.decodeSortKey(className, key)} ${{ literal: order === 1 ? 'ASC' : 'DESC' }}
    `)}`;
  }

  private _selectPopulateMap(
    context: CompileContext,
    className: string,
    name: string,
  ) {
    return _.map(context.populates, (populate, field) => this.dialect.selectPopulate(
      this, {
      className,
      name,
      includes: context.includes,
      colname: field,
    }, populate, field));
  }

  insert(options: InsertOptions, attrs: Record<string, TValue>) {

    const _attrs: [string, SQL][] = _.toPairs({
      ...this._defaultInsertOpts(options),
      ...this._encodeObjectAttrs(options.className, attrs),
    });

    const name = `_insert_$${options.className.toLowerCase()}`;

    const context = this._makeContext(options);
    const populates = this._selectPopulateMap(context, options.className, name);
    const queries = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));
    const joins = _.compact(_.map(populates, ({ join }) => join));

    return sql`
    WITH ${{ identifier: name }} AS (
      INSERT INTO ${{ identifier: options.className }}
      (${_.map(_attrs, x => sql`${{ identifier: x[0] }}`)})
      VALUES (${_.map(_attrs, x => sql`${x[1]}`)})
      RETURNING *
    )${!_.isEmpty(queries) ? sql`, ${_.map(queries, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
    SELECT ${{
        literal: [
          ...this._selectIncludes(name, context.includes),
          ..._.map(populates, ({ column }) => column),
        ], separator: ',\n'
      }}
    FROM ${{ identifier: name }}
    ${!_.isEmpty(joins) ? joins : sql``}
  `;
  }

  updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    return this._modifyQuery(
      { ...query, limit: 1 },
      (fetchName, context) => {
        const name = `_update_$${query.className.toLowerCase()}`;
        return sql`
          , ${{ identifier: name }} AS (
            UPDATE ${{ identifier: query.className }}
            SET __v = __v + 1, _updated_at = NOW()
            ${!_.isEmpty(update) ? sql`, ${this._encodeUpdateAttrs(query.className, update)}` : sql``}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          ${this._refetch(name, query, context)}
        `;
      }
    );
  }

  upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {

    const _insert: [string, SQL][] = _.toPairs({
      ...this._defaultInsertOpts(query),
      ...this._encodeObjectAttrs(query.className, setOnInsert),
    });

    return this._modifyQuery(
      { ...query, limit: 1 },
      (fetchName, context) => {
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
          ${this._refetch(upsertName, query, context)}
        `;
      }
    );
  }

  deleteOne(query: DecodedQuery<FindOneOptions>) {

    return this._modifyQuery(
      { ...query, limit: 1 },
      (fetchName, context) => {
        const name = `_delete_$${query.className.toLowerCase()}`;
        const populates = this._selectPopulateMap(context, query.className, name);
        const joins = _.compact(_.map(populates, ({ join }) => join));
        return sql`
          , ${{ identifier: name }} AS (
            DELETE FROM ${{ identifier: query.className }}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          SELECT ${{
            literal: [
              ...this._selectIncludes(name, context.includes),
              ..._.map(populates, ({ column }) => column),
            ], separator: ',\n'
          }}
          FROM ${{ identifier: name }}
          ${!_.isEmpty(joins) ? joins : sql``}
        `;
      }
    );
  }

  deleteMany(query: DecodedQuery<FindOptions>) {

    return this._modifyQuery(
      query,
      (fetchName) => sql`
        DELETE FROM ${{ identifier: query.className }}
        WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
        RETURNING 0
      `
    );
  }

}