//
//  populate.ts
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
import { SQL, sql } from '../../sql';
import { TSchema, isPointer, isPrimitive, isRelation, isShape, isVector } from '../../../../internals/schema';
import { CompileContext, Populate, QueryCompiler } from '../../sql/compiler';
import { _encodePopulateInclude } from './encode';
import { resolveColumn } from '../../../../server/query/dispatcher/validator';

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

export const selectPopulate = (
  compiler: QueryCompiler,
  parent: Pick<Populate, 'className' | 'name'>,
  populate: Populate,
  field: string
): { columns: SQL[]; join?: SQL; } => {
  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: populate.name }}.${{ identifier: field }}`;

  const subpaths = resolveSubpaths(compiler, populate);

  if (populate.type === 'pointer') {
    return {
      columns: _.map(subpaths, ({ path }) => sql`${{ identifier: populate.name }}.${{ identifier: path }} AS ${{ identifier: `${field}.${path}` }}`),
      join: sql`
        LEFT JOIN ${{ identifier: populate.name }}
        ON ${sql`(${{ quote: populate.className + '$' }} || ${_foreign('_id')})`} = ${_local(field)}
      `,
    };
  }

  let cond: SQL;
  if (_.isNil(populate.foreignField)) {
    cond = sql`${sql`(${{ quote: populate.className + '$' }} || ${_foreign('_id')})`} = ANY(${_local(field)})`;
  } else if (_isPointer(compiler.schema, populate.className, populate.foreignField)) {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(populate.colname)}`;
  } else {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(populate.colname)})`;
  }
  return {
    columns: [sql`
      ARRAY(
        SELECT to_jsonb(${{ identifier: populate.name }}) FROM (
          SELECT ${_.map(subpaths, ({ path, type }) => _encodePopulateInclude(populate.name, path, type))}
          FROM ${{ identifier: populate.name }} WHERE ${cond}
          ${!_.isEmpty(populate.sort) ? sql`ORDER BY ${compiler._encodeSort(populate.sort, { className: populate.className, name: populate.name })}` : sql``}
          ${populate.limit ? sql`LIMIT ${{ literal: `${populate.limit}` }}` : sql``}
          ${populate.skip ? sql`OFFSET ${{ literal: `${populate.skip}` }}` : sql``}
          ${compiler.selectLock ? compiler.isUpdate ? sql`FOR UPDATE NOWAIT` : sql`FOR SHARE NOWAIT` : sql``}
        ) ${{ identifier: populate.name }}
      ) AS ${{ identifier: field }}
    `],
  };
};

const encodeRemix = (
  parent: { className: string; name: string; },
  remix?: { className: string; name: string; },
) => sql`${remix?.className === parent.className ? sql`
  (SELECT * FROM ${{ identifier: remix.name }} UNION SELECT * FROM ${{ identifier: parent.className }})
` : { identifier: parent.className }}`;

export const encodeForeignField = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: { className: string; name: string; },
  foreignField: string,
  remix?: { className: string; name: string; }
): { joins: SQL[]; field: SQL; rows: boolean; array: boolean; } => {

  const { paths: [colname, ...subpath], dataType } = resolveColumn(compiler.schema, parent.className, foreignField);

  const tempName = `_populate_$${compiler.nextIdx()}`;
  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: tempName }}.${{ identifier: field }}`;

  if (_.isEmpty(subpath) && isRelation(dataType) && dataType.foreignField) {
    let cond: SQL;
    if (_isPointer(compiler.schema, dataType.target, dataType.foreignField)) {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(dataType.foreignField)}`;
    } else {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(dataType.foreignField)})`;
    }
    return {
      joins: [],
      field: sql`(
        SELECT ${sql`(${{ quote: parent.className + '$' }} || ${_foreign('_id')})`}
        FROM ${encodeRemix(parent, remix)} AS ${{ identifier: tempName }}
        WHERE ${cond}
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
    context,
    { className: dataType.target, name: tempName },
    subpath.join('.'),
    remix,
  );

  if (isPointer(dataType)) {
    return {
      joins: [sql`
        LEFT JOIN ${encodeRemix(parent, remix)} AS ${{ identifier: tempName }}
        ON ${sql`(${{ quote: dataType.target + '$' }} || ${_foreign('_id')})`} = ${_local(colname)}
      `, ...joins],
      field,
      array,
      rows,
    };
  }

  let cond: SQL;
  if (_.isNil(dataType.foreignField)) {
    cond = sql`${sql`(${{ quote: dataType.target + '$' }} || ${_foreign('_id')})`} = ANY(${_local(colname)})`;
  } else if (_isPointer(compiler.schema, dataType.target, dataType.foreignField)) {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(dataType.foreignField)}`;
  } else {
    cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(dataType.foreignField)})`;
  }
  return {
    joins: [],
    field: sql`(
      SELECT ${array ? sql`UNNEST(${field})` : field} FROM ${encodeRemix(parent, remix)} AS ${{ identifier: tempName }}
      ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
      WHERE ${cond}
    )`,
    array: false,
    rows: true,
  };
}

export const encodePopulate = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: Populate,
  remix?: { className: string; name: string; }
): Record<string, SQL> => {
  const _filter = compiler._encodeFilter(context, parent, parent.filter);
  const _populates = _.map(parent.populates, (populate, field) => selectPopulate(compiler, parent, populate, field));
  const _joins = _.compact(_.map(_populates, ({ join }) => join));
  const _includes = _.pickBy(parent.includes, v => isPrimitive(v));
  const {
    joins: _joins2 = [],
    field: _foreignField = undefined,
    rows = false,
  } = parent.foreignField ? encodeForeignField(compiler, context, {
    className: parent.className,
    name: parent.name,
  }, parent.foreignField, remix) : {};
  return _.reduce(parent.populates, (acc, populate) => ({
    ...encodePopulate(compiler, context, populate, remix),
    ...acc,
  }), {
    [parent.name]: sql`
      SELECT * FROM (
        SELECT
        ${{
        literal: [
          ..._.map(_.keys(_includes), colname => sql`${{ identifier: parent.name }}.${{ identifier: colname }}`),
          ..._.flatMap(_populates, ({ columns: column }) => column),
          ..._foreignField ? [sql`${rows ? sql`ARRAY(${_foreignField})` : _foreignField} AS ${{ identifier: parent.colname }}`] : [],
        ], separator: ',\n'
      }}
        FROM ${encodeRemix(parent, remix)} AS ${{ identifier: parent.name }}
        ${!_.isEmpty(_joins) || !_.isEmpty(_joins2) ? { literal: [..._joins, ..._joins2], separator: '\n' } : sql``}
      ) AS ${{ identifier: parent.name }}
      ${_filter ? sql`WHERE ${_filter}` : sql``}
    `,
  });
};
