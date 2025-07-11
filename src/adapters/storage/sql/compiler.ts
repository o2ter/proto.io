//
//  compiler.ts
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
import { TSchema, isPointer, isPrimitive, isRelation, isShape, shapePaths } from '../../../internals/schema';
import { QueryCoditionalSelector, QueryExpressionSelector, QueryFieldSelector, QuerySelector } from '../../../server/query/dispatcher/parser';
import { DecodedBaseQuery, DecodedQuery, FindOptions, InsertOptions, DecodedSortOption, RelationOptions } from '../../../server/storage';
import { SQL, sql } from './sql';
import { generateId } from '../../../server/crypto/random';
import { SqlDialect } from './dialect';
import { resolveColumn, resolveDataType } from '../../../server/query/dispatcher/validator';
import { decodeUpdateOp } from '../../../internals/object';
import { TUpdateOp } from '../../../internals/object/types';
import { TValueWithUndefined } from '../../../internals/types';
import { QueryAccumulator } from '../../../server/query/dispatcher/parser/accumulators';

export type QueryCompilerOptions = {
  className: string;
  filter?: QuerySelector;
  sort?: Record<string, 1 | -1> | DecodedSortOption[];
  includes: string[];
  matches: Record<string, DecodedBaseQuery>;
}

export type QueryContext = {
  name: string;
  className?: string;
  includes?: Record<string, TSchema.DataType>;
  populates?: Record<string, Populate>;
  groupMatches?: Record<string, Record<string, QueryAccumulator>>;
}

export type Populate = Required<QueryContext> & {
  colname: string;
  type: 'pointer' | 'relation';
  foreignField?: string;
  subpaths: string[];
  filter?: QuerySelector;
  sort?: Record<string, 1 | -1> | DecodedSortOption[];
  skip?: number;
  limit?: number;
}

const _resolveSortingName = (
  key: string,
  includes: Record<string, TSchema.DataType>,
  populates: Record<string, Populate>,
) => {
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
    } else if (_.some(_.keys(includes), x => _.startsWith(x, `${name}.`))) {
      resolved = name;
    } else {
      throw Error(`Invalid path: ${key}`);
    }
  }
  return resolved;
}

const _encodeSorting = (
  includes: Record<string, TSchema.DataType>,
  populates: Record<string, Populate>,
  sort?: Record<string, 1 | -1> | DecodedSortOption[],
) => {
  if (_.isArray(sort)) {
    return _.map(sort, x => ({
      order: x.order,
      expr: x.expr.mapKey(key => {
        const resolved = _resolveSortingName(key, includes, populates);
        if (!resolved) throw Error(`Invalid path: ${key}`);
        return resolved;
      }),
    }));
  }
  const sorting: Record<string, 1 | -1> = {};
  for (const [key, order] of _.toPairs(sort)) {
    const resolved = _resolveSortingName(key, includes, populates);
    if (!resolved) throw Error(`Invalid path: ${key}`);
    sorting[resolved] = order;
  }
  return sorting;
}

const _defaultInsertOpts = (options: InsertOptions) => {
  const id = generateId(options.objectIdSize);
  return {
    _id: sql`${{ value: id }}`,
    ...options.className === 'User' ? {
      _rperm: sql`${{ value: [id] }}`,
      _wperm: sql`${{ value: [id] }}`,
    } : {},
  };
}

type _SelectOptions = {
  select?: SQL,
  sort?: SQL,
  extraFilter?: SQL,
};

export class QueryCompiler {

  schema: Record<string, TSchema>;
  dialect: SqlDialect;
  selectLock: boolean;
  isUpdate: boolean;

  extraFilter?: (className: string) => QuerySelector;

  idx = 0;

  constructor(options: {
    schema: Record<string, TSchema>;
    dialect: SqlDialect;
    selectLock: boolean;
    isUpdate: boolean;
    extraFilter?: (className: string) => QuerySelector;
  }) {
    this.schema = options.schema;
    this.dialect = options.dialect;
    this.selectLock = options.selectLock;
    this.isUpdate = options.isUpdate;
    this.extraFilter = options.extraFilter;
  }

  nextIdx() {
    return this.idx++;
  }

  private _encodeIncludes(query: {
    className: string;
    includes: string[];
    matches: Record<string, DecodedBaseQuery>;
    groupMatches: Record<string, Record<string, QueryAccumulator>>;
  }) {

    const names: Record<string, TSchema.DataType> = {};
    const populates: Record<string, Populate> = {};
    const groupMatches: Record<string, Record<string, QueryAccumulator>> = {};

    for (const include of query.includes) {
      const { paths: [colname, ...subpath], dataType } = resolveColumn(this.schema, query.className, include);

      names[colname] = dataType;

      if (isRelation(dataType) && !_.isNil(query.groupMatches[colname])) groupMatches[colname] = query.groupMatches[colname];

      if (isPointer(dataType) || isRelation(dataType)) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        const _matches = query.matches[colname] ?? {};
        populates[colname] = populates[colname] ?? {
          name: `t${this.nextIdx()}`,
          className: dataType.target,
          subpaths: [],
          filter: _matches.filter,
          skip: _matches.skip,
          limit: _matches.limit,
          type: dataType.type,
          colname,
        };
        if (isRelation(dataType) && dataType.foreignField) {
          const targetType = resolveDataType(this.schema, dataType.target, dataType.foreignField);
          if (_.isNil(targetType)) throw Error(`Invalid path: ${include}`);
          if (!isPointer(targetType) && !isRelation(targetType)) throw Error(`Invalid path: ${include}`);
          populates[colname].foreignField = dataType.foreignField;
        }
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const [colname, populate] of _.toPairs(populates)) {
      const _matches = query.matches[colname] ?? {};
      const { includes, populates, groupMatches } = this._encodeIncludes({
        className: populate.className,
        includes: populate.subpaths,
        matches: _matches.matches,
        groupMatches: {
          ..._.mapKeys(_.pickBy(query.groupMatches, (x, k) => _.startsWith(k, `${colname}.`)), (x, k) => k.slice(colname.length + 1)),
          ..._matches.groupMatches ?? {},
        },
      });
      populate.sort = _encodeSorting(includes, populates, _matches.sort);
      populate.includes = includes;
      populate.populates = populates;
      populate.groupMatches = groupMatches;
    }

    return {
      className: query.className,
      includes: names,
      populates,
      groupMatches,
    };
  }

  private _baseSelectQuery(
    query: DecodedQuery<FindOptions & RelationOptions>,
    options?: _SelectOptions | ((x: { fetchName: string; }) => _SelectOptions),
  ) {

    const fetchName = `_fetch_$${query.className.toLowerCase()}`;
    const context = { ...this._encodeIncludes(query), name: fetchName };

    const _stages = _.mapValues(context.populates, (populate) => this.dialect.encodePopulate(this, populate));
    const stages = _.fromPairs(_.flatMap(_.values(_stages), (p) => _.toPairs(p)));

    const baseFilter = this._encodeFilter(context, query.filter);
    const populates = this._selectPopulateMap(context);
    const joins = _.compact(_.map(populates, ({ join }) => join));

    const includes = {
      literal: [
        ...this._selectIncludes(fetchName, context.includes),
        ..._.flatMap(populates, ({ columns }) => columns),
      ],
      separator: ',\n',
    };

    const _options = _.isFunction(options) ? options({ fetchName }) : options;
    const filter = _.compact([
      baseFilter,
      _options?.extraFilter,
      query.relatedBy && this.dialect.encodeRelation(this, context, query.relatedBy),
    ]);

    return {
      stages,
      fetchName,
      context,
      query: sql`
        SELECT ${_options?.select ? _options?.select : sql`*`} FROM (
          SELECT ${includes}
          FROM ${{ identifier: query.className }} AS ${{ identifier: fetchName }}
          ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
          ${this.selectLock ? this.isUpdate ? sql`FOR UPDATE NOWAIT` : sql`FOR SHARE NOWAIT` : sql``}
        ) AS ${{ identifier: fetchName }}
        ${!_.isEmpty(filter) ? sql`WHERE ${{ literal: _.map(filter, x => sql`(${x})`), separator: ' AND ' }}` : sql``}
        ${_options?.sort ? _options?.sort : sql``}
        ${!_.isEmpty(query.sort) ? sql`ORDER BY ${this._encodeSort(query.sort, {
          name: fetchName,
          className: query.className,
          groupMatches: query.groupMatches,
        })}` : sql``}
        ${query.limit ? sql`LIMIT ${{ literal: `${query.limit}` }}` : sql``}
        ${query.skip ? sql`OFFSET ${{ literal: `${query.skip}` }}` : sql``}
      `,
    };
  }

  private _refetch(
    name: string,
    query: DecodedQuery<FindOptions>,
  ) {

    const _context = { ...this._encodeIncludes(query), name };
    const populates = _.mapValues(
      _context.populates, (populate) => this.dialect.encodePopulate(this, populate, { className: query.className, name })
    );
    const stages = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const _populates = this._selectPopulateMap(_context);
    const _joins = _.compact(_.map(_populates, ({ join }) => join));

    const _includes = {
      literal: [
        ...this._selectIncludes(name, _context.includes),
        ..._.flatMap(_populates, ({ columns }) => columns),
      ], separator: ',\n'
    };

    return sql`
      ${!_.isEmpty(stages) ? sql`, ${_.map(stages, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT ${_includes}
      FROM ${{ identifier: name }}
      ${!_.isEmpty(_joins) ? { literal: _joins, separator: '\n' } : sql``}
    `;
  }

  _selectQuery(
    query: DecodedQuery<FindOptions & RelationOptions>,
    options?: _SelectOptions | ((x: { fetchName: string; }) => _SelectOptions),
  ) {
    const { stages, query: _query } = this._baseSelectQuery(query, options);
    return sql`
      ${!_.isEmpty(stages) ? sql`WITH ${_.map(stages, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${_query}
    `;
  }

  private _modifyQuery(
    query: DecodedQuery<FindOptions>,
    action: (fetchName: string, context: QueryContext & { className: string; }) => SQL
  ) {
    const { stages, fetchName, query: _query, context } = this._baseSelectQuery(query);
    stages[fetchName] = _query;
    return sql`
      ${!_.isEmpty(stages) ? sql`WITH ${_.map(stages, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      ${action(fetchName, context)}
    `;
  }

  private _encodeUpdateAttrs(className: string, attrs: Record<string, TUpdateOp>): SQL[] {
    const updates: SQL[] = [
      sql`__v = __v + 1`,
      sql`_updated_at = NOW()`,
    ];
    for (const [path, op] of _.toPairs(attrs)) {
      const { paths: [column, ...subpath], dataType } = resolveColumn(this.schema, className, path);
      if (isShape(dataType)) {
        const [_op, value] = decodeUpdateOp(op);
        if (_op !== '$set') throw Error('Invalid update operation');
        for (const { path, type } of shapePaths(dataType)) {
          if (!isRelation(type) || _.isNil(type.foreignField)) {
            updates.push(sql`${{ identifier: `${column}.${path}` }} = ${this.dialect.updateOperation(
              [`${column}.${path}`], type, { $set: _.get(value, path) ?? null }
            )}`);
          }
        }
      } else {
        updates.push(sql`${{ identifier: column }} = ${this.dialect.updateOperation(
          [column, ...subpath], dataType, op
        )}`);
      }
    }
    return updates;
  }

  private _encodeObjectAttrs(className: string, attrs: Record<string, TValueWithUndefined>): Record<string, SQL> {
    const result: Record<string, SQL> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      const { paths: [column, ...subpath], dataType } = resolveColumn(this.schema, className, key);
      if (!_.isEmpty(subpath)) throw Error(`Invalid insert key: ${key}`);
      if (isShape(dataType)) {
        for (const { path, type } of shapePaths(dataType)) {
          if (!isRelation(type) || _.isNil(type.foreignField)) {
            result[`${column}.${path}`] = this.dialect.encodeType(`${column}.${path}`, type, _.get(value, path) ?? null);
          }
        }
      } else {
        result[column] = this.dialect.encodeType(column, dataType, value);
      }
    }
    return result;
  }

  private _encodeCoditionalSelector(
    parent: QueryContext,
    filter: QueryCoditionalSelector,
  ) {
    const queries = _.compact(_.map(filter.exprs, x => this._encodeFilter(parent, x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }})`;
      case '$nor': return sql`(${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }})`;
      case '$or': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }})`;
    }
  }

  _encodeFilter(
    parent: QueryContext,
    filter: QuerySelector,
  ): SQL | undefined {
    if (filter instanceof QueryCoditionalSelector) {
      return this._encodeCoditionalSelector(parent, filter);
    }
    if (filter instanceof QueryFieldSelector) {
      return this.dialect.encodeFieldExpression(this, parent, filter.field, filter.expr);
    }
    if (filter instanceof QueryExpressionSelector) {
      return this.dialect.encodeBooleanExpression(this, parent, filter.expr);
    }
  }

  _selectIncludes(
    className: string,
    includes: Record<string, TSchema.DataType>,
  ): SQL[] {
    const _includes = _.pickBy(includes, v => _.isString(v) || (v.type !== 'pointer' && v.type !== 'relation'));
    return _.flatMap(_includes, (dataType, colname) => {
      if (!_.isString(dataType) && isPrimitive(dataType) && !_.isNil(dataType.default)) {
        return sql`COALESCE(${{ identifier: className }}.${{ identifier: colname }}, ${{ value: dataType.default }}) AS ${{ identifier: colname }}`;
      }
      return sql`${{ identifier: className }}.${{ identifier: colname }}`;
    });
  }

  _encodeSort(
    sort: Record<string, 1 | -1> | DecodedSortOption[],
    parent: QueryContext,
  ): SQL {
    if (_.isArray(sort)) {
      return sql`${_.map(sort, ({ expr, order }) => {
        const _expr = this.dialect.encodeSortExpression(this, parent, expr);
        if (!_expr) throw Error('Invalid expression');
        return sql`${_expr} ${{ literal: order === 1 ? 'ASC' : 'DESC' }}`;
      })}`;
    }
    return sql`${_.map(sort, (order, key) => sql`
      ${this.dialect.encodeSortKey(this, parent, key)} ${{ literal: order === 1 ? 'ASC' : 'DESC' }}
    `)}`;
  }

  private _selectPopulateMap(
    context: QueryContext & { className: string; },
  ) {
    return _.map(context.populates, (populate, field) => this.dialect.selectPopulate(
      this,
      context,
      populate,
      field,
    ));
  }

  insert(options: InsertOptions, values: Record<string, TValueWithUndefined>[]) {

    const _values: Record<string, SQL>[] = _.map(values, attr => ({
      ..._defaultInsertOpts(options),
      ...this._encodeObjectAttrs(options.className, attr),
    }));

    const keys = _.uniq(_.flatMap(_values, x => _.keys(x)));

    const name = `_insert_$${options.className.toLowerCase()}`;

    const context = { ...this._encodeIncludes(options), name };
    const populates = _.mapValues(context.populates, (populate) => this.dialect.encodePopulate(this, populate));
    const stages = _.fromPairs(_.flatMap(_.values(populates), (p) => _.toPairs(p)));

    const _populates = this._selectPopulateMap(context);
    const joins = _.compact(_.map(_populates, ({ join }) => join));

    return sql`
      WITH ${{ identifier: name }} AS (
        INSERT INTO ${{ identifier: options.className }}
        (${_.map(keys, x => sql`${{ identifier: x }}`)})
        VALUES ${_.map(_values, v => sql`(${_.map(keys, k => sql`${v[k]}`)})`)}
        RETURNING *
      )${!_.isEmpty(stages) ? sql`, ${_.map(stages, (q, n) => sql`${{ identifier: n }} AS (${q})`)}` : sql``}
      SELECT ${{
        literal: [
          ...this._selectIncludes(name, context.includes),
          ..._.flatMap(_populates, ({ columns }) => columns),
        ], separator: ',\n'
      }}
      FROM ${{ identifier: name }}
      ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
    `;
  }

  update(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>) {
    return this._modifyQuery(
      query,
      (fetchName) => {
        const name = `_update_$${query.className.toLowerCase()}`;
        return sql`
          , ${{ identifier: name }} AS (
            UPDATE ${{ identifier: query.className }}
            SET ${this._encodeUpdateAttrs(query.className, update)}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          ${this._refetch(name, query)}
        `;
      }
    );
  }

  upsert(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValueWithUndefined>) {

    const _insert: [string, SQL][] = _.toPairs({
      ..._defaultInsertOpts(query),
      ...this._encodeObjectAttrs(query.className, setOnInsert),
    });

    return this._modifyQuery(
      query,
      (fetchName) => {
        const updateName = `_update_$${query.className.toLowerCase()}`;
        const insertName = `_insert_$${query.className.toLowerCase()}`;
        const upsertName = `_upsert_$${query.className.toLowerCase()}`;
        return sql`
          , ${{ identifier: updateName }} AS (
            UPDATE ${{ identifier: query.className }}
            SET ${this._encodeUpdateAttrs(query.className, update)}
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
          ${this._refetch(upsertName, query)}
        `;
      }
    );
  }

  delete(query: DecodedQuery<FindOptions>) {

    return this._modifyQuery(
      query,
      (fetchName, context) => {
        const name = `_delete_$${query.className.toLowerCase()}`;
        const populates = this._selectPopulateMap({ ...context, name });
        const joins = _.compact(_.map(populates, ({ join }) => join));
        return sql`
          , ${{ identifier: name }} AS (
            DELETE FROM ${{ identifier: query.className }}
            WHERE ${{ identifier: query.className }}._id IN (SELECT ${{ identifier: fetchName }}._id FROM ${{ identifier: fetchName }})
            RETURNING *
          )
          SELECT ${{
            literal: [
              ...this._selectIncludes(name, context.includes ?? {}),
              ..._.flatMap(populates, ({ columns }) => columns),
            ], separator: ',\n'
          }}
          FROM ${{ identifier: name }}
          ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
        `;
      }
    );
  }

}