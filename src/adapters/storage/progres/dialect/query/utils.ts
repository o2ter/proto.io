//
//  utils.ts
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
import { SQL, sql } from '../../../sql';
import { QueryCompiler } from '../../../sql/compiler';
import { TSchema, isPointer, isPrimitive, isRelation, isShape, isVector } from '../../../../../internals/schema';
import { QueryValidator, resolveColumn } from '../../../../../server/query/dispatcher/validator';

const _fetchElement = (
  parent: { className?: string; name: string; },
  colname: string,
  subpath: string[],
  dataType?: TSchema.DataType,
) => {
  const element = sql`${{ identifier: parent.name }}.${{ identifier: parent.name.startsWith('_expr_$') ? '$' : colname }}`;
  if (!parent.className) {
    if (colname !== '$') {
      return {
        element: sql`jsonb_extract_path(${element}, ${_.map([colname, ...subpath], x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`,
        json: true,
      };
    } else if (!_.isEmpty(subpath)) {
      return {
        element: sql`jsonb_extract_path(${element}, ${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`,
        json: true,
      };
    }
  } else if (!_.isEmpty(subpath)) {
    const _subpath = sql`${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)}`;
    if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'relation'))) {
      return {
        element: sql`jsonb_extract_path(to_jsonb(${element}), ${_subpath})`,
        json: true,
      };
    } else {
      return {
        element: sql`jsonb_extract_path(${element}, ${_subpath})`,
        json: true,
      };
    }
  }
  if (parent.name.startsWith('_expr_$') && colname !== '$') {
    return {
      element: sql`jsonb_extract_path(${element}, ${{ quote: colname.startsWith('$') ? `$${colname}` : colname }})`,
      json: true,
    };
  }
  return { element, json: false };
};

const _isRelation = (
  schema: Record<string, TSchema>,
  className: string,
  path: string,
) => {
  let fields = schema[className].fields;
  let last;
  let result = false;
  for (const key of _.toPath(path)) {
    const dataType = fields[key];
    if (_.isNil(dataType)) return;
    if (isPrimitive(dataType) || isVector(dataType)) return;
    if (isShape(dataType)) {
      fields = dataType.shape;
      continue;
    }
    if (_.isNil(schema[dataType.target])) return;
    if (dataType.type === 'relation') result = true;
    fields = schema[dataType.target].fields;
    last = dataType;
  }
  return result || last?.type === 'relation' ? last?.target : undefined;
}

const resolvePaths = (
  compiler: QueryCompiler,
  className: string,
  paths: string[],
): { dataType: TSchema.DataType; colname: string; subpath: string[]; } => {
  const { paths: [colname, ...subpath], dataType } = resolveColumn(compiler.schema, className, paths.join('.'));
  if (!_.isEmpty(subpath) && isVector(dataType)) {
    if (subpath.length !== 1) throw Error(`Invalid key: ${paths.join('.')}`);
    const idx = parseInt(subpath[0]);
    if (_.isSafeInteger(idx) && idx >= 0 && idx < dataType.dimension) {
      return { dataType: 'number', colname: `${colname}[${idx}]`, subpath: [] };
    } else {
      throw Error(`Invalid key: ${paths.join('.')}`);
    }
  }
  if (!_.isEmpty(subpath) && isPointer(dataType)) {
    const resolved = resolvePaths(compiler, dataType.target, subpath);
    return { ...resolved, colname: `${colname}.${resolved.colname}` };
  }
  const digit = _.first(subpath);
  if (!_.isEmpty(subpath) && isRelation(dataType) && digit?.match(QueryValidator.patterns.digits)) {
    const resolved = resolvePaths(compiler, dataType.target, _.slice(subpath, 1));
    return { dataType, colname, subpath: [digit, resolved.colname, ...resolved.subpath] };
  }
  return { dataType, colname, subpath };
}

export const fetchElement = (
  compiler: QueryCompiler,
  parent: { className?: string; name: string; },
  field: string,
) => {
  if (parent.className) {
    const { dataType, colname, subpath } = resolvePaths(compiler, parent.className, _.toPath(field));
    if (!_.isEmpty(subpath)) {
      const relationTarget = _isRelation(compiler.schema, parent.className, field);
      if (relationTarget) {
        const { element } = _fetchElement(parent, colname, subpath, dataType);
        return {
          element,
          dataType: { type: 'relation', target: relationTarget } as const,
          relation: {
            target: relationTarget,
            sql: (callback: (value: SQL) => SQL) => sql`SELECT 
              ${callback(sql`UNNEST`)} 
            FROM UNNEST(${{ identifier: parent.name }}.${{ identifier: colname }})`,
          },
        };
      }
    }
    if (isPointer(dataType)) return { element: sql`${{ identifier: parent.name }}.${{ identifier: `${colname}._id` }}`, dataType };
    const { element, json } = _fetchElement(parent, colname, subpath, dataType);
    return {
      element,
      dataType: json ? null : dataType,
      relation: isRelation(dataType) ? {
        target: dataType.target,
        sql: (callback: (value: SQL) => SQL) => sql`SELECT
          ${callback(sql`${json ? sql`VALUE` : sql`UNNEST`}`)}
        FROM ${json ? sql`jsonb_array_elements(${element})` : sql`UNNEST(${element})`}`,
      } : null,
    };
  }
  const [colname, ...subpath] = _.toPath(field);
  const { element } = _fetchElement(parent, colname, subpath);
  return { element, dataType: null, relation: null };
};
