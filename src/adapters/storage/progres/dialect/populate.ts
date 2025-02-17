//
//  populate.ts
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
import { SQL, sql } from '../../sql';
import { TSchema, isPointer, isPrimitive, isRelation, isShape, isVector } from '../../../../internals/schema';
import { Populate, QueryCompiler, QueryContext } from '../../sql/compiler';
import { _jsonPopulateInclude } from './encode';
import { resolveColumn } from '../../../../server/query/dispatcher/validator';
import { QueryAccumulator } from '../../../../server/query/dispatcher/parser/accumulators';
import { encodeQueryExpression } from './query';
import { encodeTypedQueryExpression } from './query/expressions';

const resolveSubpaths = (
  compiler: QueryCompiler,
  populate: Populate,
) => {
  const subpaths: {
    path: string;
    type: TSchema.DataType;
  }[] = [];
  for (const [name, type] of _.toPairs(populate.includes)) {
    if (isPointer(type)) {
      subpaths.push(..._.map(resolveSubpaths(compiler, populate.populates[name]), ({ path, type }) => ({
        path: `${name}.${path}`,
        type,
      })));
    } else {
      subpaths.push({
        path: name,
        type,
      });
    }
  }
  return subpaths;
}

const _isPointer = (
  schema: Record<string, TSchema>,
  className: string,
  path: string,
) => {
  let fields = schema[className].fields;
  let last;
  for (const key of _.toPath(path)) {
    const dataType = fields[key];
    if (_.isNil(dataType)) throw Error(`Invalid path: ${path}`);
    if (isPrimitive(dataType) || isVector(dataType)) throw Error(`Invalid path: ${path}`);
    if (isShape(dataType)) {
      fields = dataType.shape;
      continue;
    }
    if (dataType.type !== 'pointer') return false;
    if (_.isNil(schema[dataType.target])) throw Error(`Invalid path: ${path}`);
    fields = schema[dataType.target].fields;
    last = dataType;
  }
  return last?.type === 'pointer';
}

export const _selectRelationPopulate = (
  compiler: QueryCompiler,
  parent: QueryContext & { className: string; },
  populate: Populate,
  field: string,
  encode: boolean,
) => {
  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: populate.name }}.${{ identifier: field }}`;

  const subpaths = resolveSubpaths(compiler, populate);

  let cond: SQL;
  if (_.isNil(populate.foreignField)) {
    cond = sql`${sql`(${{ quote: populate.className + '$' }} || ${_foreign('_id')})`} = ANY(${_local(field)})`;
  } else if (_isPointer(compiler.schema, populate.className, populate.foreignField)) {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(populate.colname)}`;
  } else {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(populate.colname)})`;
  }
  return sql`
    SELECT ${_.compact(_.flatMap(subpaths, ({ path, type }) =>
      encode ? [
        _jsonPopulateInclude(populate.name, path, type)
      ] : [
        ...(populate.groupMatches[path] ? _.map(_.keys(populate.groupMatches[path]), k =>
          sql`${{ identifier: populate.name }}.${{ identifier: `${path}.${k}` }}`
        ) : [
          sql`${{ identifier: populate.name }}.${{ identifier: path }}`
        ]),
        isRelation(type) && sql`${{ identifier: populate.name }}.${{ identifier: `$${path}` }}`,
      ]
    ))}
    FROM ${{ identifier: populate.name }} WHERE ${cond}
    ${!_.isEmpty(populate.sort) ? sql`ORDER BY ${compiler._encodeSort(populate.sort, { className: populate.className, name: populate.name })}` : sql``}
    ${populate.limit ? sql`LIMIT ${{ literal: `${populate.limit}` }}` : sql``}
    ${populate.skip ? sql`OFFSET ${{ literal: `${populate.skip}` }}` : sql``}
    ${compiler.selectLock ? compiler.isUpdate ? sql`FOR UPDATE NOWAIT` : sql`FOR SHARE NOWAIT` : sql``}
  `;
}

export const selectPopulate = (
  compiler: QueryCompiler,
  parent: QueryContext & { className: string; },
  populate: Populate,
  field: string,
): { columns: SQL[]; join?: SQL; } => {
  if (populate.type === 'relation') {
    const { groupMatches } = parent;
    const columns = [
      sql`${{ identifier: parent.name }}.${{ identifier: field }} AS ${{ identifier: `$${field}` }}`,
    ];
    if (!_.isEmpty(groupMatches?.[field])) {
      for (const [key, { type, expr }] of _.entries(groupMatches[field])) {
        switch (type) {
          case '$count':
            columns.push(sql`
              (
                SELECT COUNT(*) FROM (
                  ${_selectRelationPopulate(compiler, parent, populate, field, false)}
                ) ${{ identifier: populate.name }}
              ) AS ${{ identifier: `${field}.${key}` }}
            `);
            break;
          case '$avg':
          case '$sum':
            {
              const op = {
                '$avg': 'AVG',
                '$sum': 'SUM',
              }[type];
              if (!expr) throw Error('Invalid expression');
              const exprs = encodeTypedQueryExpression(compiler, parent, expr);
              const { sql: value } = (_.includes(['$avg'], type) ? _.find(exprs, e => e.type === 'number') : _.first(exprs)) ?? {};
              if (!value) throw Error('Invalid expression');
              columns.push(sql`
                (
                  SELECT ${{ literal: op }}(${value}) FROM (
                    ${_selectRelationPopulate(compiler, parent, populate, field, false)}
                  ) ${{ identifier: populate.name }}
                ) AS ${{ identifier: `${field}.${key}` }}
              `);
            }
            break;
          default: break;
        }
      }
    } else {
      columns.push(sql`
        ARRAY(
          SELECT to_jsonb(${{ identifier: populate.name }}) FROM (
            ${_selectRelationPopulate(compiler, parent, populate, field, true)}
          ) ${{ identifier: populate.name }}
        ) AS ${{ identifier: field }}
      `);
    }
    return { columns };
  }

  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: populate.name }}.${{ identifier: field }}`;

  const subpaths = resolveSubpaths(compiler, populate);
  return {
    columns: _.compact(_.flatMap(subpaths, ({ path, type }) => [
      ...populate.groupMatches[path] ? _.map(_.keys(populate.groupMatches[path]), k =>
        sql`${{ identifier: populate.name }}.${{ identifier: `${path}.${k}` }} AS ${{ identifier: `${field}.${path}.${k}` }}`
      ) : [
        sql`${{ identifier: populate.name }}.${{ identifier: path }} AS ${{ identifier: `${field}.${path}` }}`
      ],
      isRelation(type) && sql`${{ identifier: populate.name }}.${{ identifier: `$${path}` }} AS ${{ identifier: `$${field}.${path}` }}`,
    ])),
    join: sql`
      LEFT JOIN ${{ identifier: populate.name }}
      ON ${sql`(${{ quote: populate.className + '$' }} || ${_foreign('_id')})`} = ${_local(field)}
    `,
  };
};

const encodeRemix = (
  parent: { className: string; },
  remix?: QueryContext & { className: string; },
) => sql`${remix?.className === parent.className ? sql`
  (SELECT * FROM ${{ identifier: remix.name }} UNION SELECT * FROM ${{ identifier: parent.className }})
` : { identifier: parent.className }}`;

export const encodeForeignField = (
  compiler: QueryCompiler,
  parent: QueryContext & { className: string; },
  foreignField: string,
  remix?: QueryContext & { className: string; }
): { joins: SQL[]; field: SQL; rows: boolean; array: boolean; } => {

  const { paths: [colname, ...subpath], dataType } = resolveColumn(compiler.schema, parent.className, foreignField);

  const tempName = `_populate_$${compiler.nextIdx()}`;
  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: tempName }}.${{ identifier: field }}`;

  if (_.isEmpty(subpath) && isRelation(dataType) && dataType.foreignField) {
    const { joins, field, rows, array } = encodeForeignField(
      compiler,
      { className: dataType.target, name: tempName },
      dataType.foreignField,
      remix,
    );
    return {
      joins: [],
      field: sql`(
        SELECT ${sql`(${{ quote: dataType.target + '$' }} || ${_foreign('_id')})`}
        FROM ${encodeRemix({ className: dataType.target }, remix)} AS ${{ identifier: tempName }}
        ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
        WHERE ${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${array || rows ? sql`ANY(${field})` : field}
      )`,
      array: false,
      rows: true,
    };
  }

  if (_.isEmpty(subpath)) {
    return {
      joins: [],
      field: sql`${{ identifier: parent.name }}.${{ identifier: foreignField }}`,
      array: isRelation(dataType),
      rows: false,
    };
  }

  if (!isPointer(dataType) && !isRelation(dataType)) throw Error(`Invalid path: ${foreignField}`);

  const { joins, field, rows, array } = encodeForeignField(
    compiler,
    { className: dataType.target, name: tempName },
    subpath.join('.'),
    remix,
  );

  const cond: (SQL | undefined)[] = [];
  if (compiler.extraFilter) {
    const filter = compiler.extraFilter(dataType.target);
    cond.push(compiler._encodeFilter({ className: dataType.target, name: tempName }, filter));
  }
  if (isPointer(dataType)) {
    cond.push(
      sql`${sql`(${{ quote: dataType.target + '$' }} || ${_foreign('_id')})`} = ${_local(colname)}`
    );
    return {
      joins: [sql`
        LEFT JOIN ${encodeRemix({ className: dataType.target }, remix)} AS ${{ identifier: tempName }}
        ON ${{ literal: _.map(_.compact(cond), x => sql`(${x})`), separator: ' AND ' }}
      `, ...joins],
      field,
      array,
      rows,
    };
  }

  if (_.isNil(dataType.foreignField)) {
    cond.push(
      sql`${sql`(${{ quote: dataType.target + '$' }} || ${_foreign('_id')})`} = ANY(${_local(colname)})`
    );
  } else if (_isPointer(compiler.schema, dataType.target, dataType.foreignField)) {
    cond.push(
      sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(dataType.foreignField)}`
    );
  } else {
    cond.push(
      sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(dataType.foreignField)})`
    );
  }
  return {
    joins: [],
    field: sql`(
      SELECT ${array ? sql`UNNEST(${field})` : field}
      FROM ${encodeRemix({ className: dataType.target }, remix)} AS ${{ identifier: tempName }}
      ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
      WHERE ${{ literal: _.map(_.compact(cond), x => sql`(${x})`), separator: ' AND ' }}
    )`,
    array: false,
    rows: true,
  };
}

export const encodePopulate = (
  compiler: QueryCompiler,
  parent: Populate,
  remix?: QueryContext & { className: string; }
): Record<string, SQL> => {
  const _filter = _.compact([
    parent.filter && compiler._encodeFilter(parent, parent.filter),
    compiler.extraFilter && compiler._encodeFilter(parent, compiler.extraFilter(parent.className)),
  ]);
  const _populates = _.map(parent.populates, (populate, field) => selectPopulate(compiler, parent, populate, field));
  const _joins = _.compact(_.map(_populates, ({ join }) => join));
  const {
    joins: _joins2 = [],
    field: _foreignField = undefined,
    rows = false,
  } = parent.foreignField ? encodeForeignField(compiler, {
    className: parent.className,
    name: parent.name,
  }, parent.foreignField, remix) : {};
  return _.reduce(parent.populates, (acc, populate) => ({
    ...encodePopulate(compiler, populate, remix),
    ...acc,
  }), {
    [parent.name]: sql`
      SELECT * FROM (
        SELECT
        ${{
        literal: [
          ...compiler._selectIncludes(parent.name, parent.includes),
          ..._.flatMap(_populates, ({ columns: column }) => column),
          ..._foreignField ? [sql`${rows ? sql`ARRAY(${_foreignField})` : _foreignField} AS ${{ identifier: parent.colname }}`] : [],
        ], separator: ',\n'
      }}
        FROM ${encodeRemix(parent, remix)} AS ${{ identifier: parent.name }}
        ${!_.isEmpty(_joins) || !_.isEmpty(_joins2) ? { literal: [..._joins, ..._joins2], separator: '\n' } : sql``}
      ) AS ${{ identifier: parent.name }}
      ${!_.isEmpty(_filter) ? sql`WHERE ${{ literal: _.map(_.compact(_filter), x => sql`(${x})`), separator: ' AND ' }}` : sql``}
    `,
  });
};
