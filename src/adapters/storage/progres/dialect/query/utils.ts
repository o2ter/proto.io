//
//  utils.ts
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
import { sql } from '../../../sql';
import { Populate, QueryCompiler, QueryContext } from '../../../sql/compiler';
import { TSchema, _isTypeof, isPointer, isRelation, isVector } from '../../../../../internals/schema';
import { QueryValidator, resolveColumn } from '../../../../../server/query/dispatcher/validator';
import { accumulatorKeyTypes } from '../../../../../internals/query/types/accumulators';

const _fetchElement = (
  parent: QueryContext,
  colname: string,
  subpath: string[],
  dataType?: TSchema.DataType,
) => {
  const element = sql`${{ identifier: parent.name }}.${{ identifier: parent.name.startsWith('_doller_expr_$') ? '$' : colname }}`;
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
    const match = parent.groupMatches?.[colname]?.[subpath[0]];
    if (dataType && isRelation(dataType) && subpath.length === 1 && match) {
      return {
        element: sql`jsonb_extract_path(to_jsonb(${element}), ${_subpath})`,
        json: true,
        match: {
          element: sql`${{ identifier: parent.name }}.${{ identifier: `${colname}.${subpath[0]}` }}`,
          dataType: accumulatorKeyTypes[match.type],
        },
      };
    } else if (dataType && _isTypeof(dataType, ['array', 'string[]', 'relation'])) {
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
  if (parent.name.startsWith('_doller_expr_$') && colname !== '$') {
    return {
      element: sql`jsonb_extract_path(${element}, ${{ quote: colname.startsWith('$') ? `$${colname}` : colname }})`,
      json: true,
    };
  }
  return { element, json: false };
};

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

const _resolvePopulate = (path: string[], populates?: Record<string, Populate>): Populate | undefined => {
  let [colname, ...subpath] = path;
  while (populates && !_.isEmpty(subpath)) {
    const populate = populates[colname];
    if (populate) return _resolvePopulate(subpath, populate.populates);
    const [key, ...remain] = subpath;
    colname = `${colname}.${key}`;
    subpath = remain;
  }
  return populates?.[colname];
}

export const fetchElement = (
  compiler: QueryCompiler,
  parent: QueryContext,
  field: string,
) => {
  if (parent.className) {
    const { dataType, colname, subpath } = resolvePaths(compiler, parent.className, _.toPath(field));
    const { element, json, match } = _fetchElement(parent, colname, subpath, dataType);
    if (isPointer(dataType)) return { element: sql`${{ identifier: parent.name }}.${{ identifier: `${colname}._id` }}`, dataType };
    const populate = isRelation(dataType) && _resolvePopulate(_.toPath(colname), parent.populates);
    if (!populate) return { element, dataType: json ? null : dataType };
    return {
      element,
      dataType: json ? null : dataType,
      match,
      relation: {
        colname,
        target: dataType.target,
        populate,
      },
    };
  }
  if (field === '$') {
    const mapping = {
      'number': '_doller_num_expr_$',
      'string': '_doller_str_expr_$',
    };
    for (const [key, value] of _.entries(mapping)) {
      if (parent.name.startsWith(value)) {
        return {
          element: sql`${{ identifier: parent.name }}.${{ identifier: '$' }}`,
          dataType: key as TSchema.DataType,
          relation: null,
        };
      }
    }
  }
  const [colname, ...subpath] = _.toPath(field);
  const { element } = _fetchElement(parent, colname, subpath);
  return { element, dataType: null, relation: null };
};
