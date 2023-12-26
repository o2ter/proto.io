//
//  utils.ts
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
import { sql } from '../../../../../server/sql';
import { QueryCompiler } from '../../../../../server/sql/compiler';
import { TSchema, isPointer, isRelation } from '../../../../../internals/schema';
import { QueryValidator } from '../../../../../server/query/validator/validator';

const _fetchElement = (
  compiler: QueryCompiler,
  parent: { className?: string; name: string; },
  colname: string,
  subpath: string[],
) => {
  const element = sql`${{ identifier: parent.name }}.${{ identifier: parent.name.startsWith('_expr_$') ? '$' : colname }}`;
  if (!parent.className) {
    if (colname !== '$') {
      return sql`jsonb_extract_path(${element}, ${_.map([colname, ...subpath], x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
    } else if (!_.isEmpty(subpath)) {
      return sql`jsonb_extract_path(${element}, ${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
    }
  } else if (!_.isEmpty(subpath)) {
    const _subpath = sql`${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)}`;
    const _type = compiler.schema[parent.className].fields[colname];
    if (_type === 'array' || (!_.isString(_type) && (_type?.type === 'array' || _type?.type === 'relation'))) {
      return sql`jsonb_extract_path(to_jsonb(${element}), ${_subpath})`;
    } else {
      return sql`jsonb_extract_path(${element}, ${_subpath})`;
    }
  }
  return element;
};

const resolvePaths = (
  compiler: QueryCompiler,
  className: string,
  paths: string[],
): { dataType: TSchema.DataType; colname: string; subpath: string[]; } => {
  const [colname, ...subpath] = paths;
  const dataType = compiler.schema[className].fields[colname];
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
    if (isPointer(dataType)) return { element: sql`${{ identifier: parent.name }}.${{ identifier: `${colname}._id` }}`, dataType };
    const element = _fetchElement(compiler, parent, colname, subpath);
    return { element, dataType: _.isEmpty(subpath) ? dataType : null };
  }
  const [colname, ...subpath] = _.toPath(field);
  const element = _fetchElement(compiler, parent, colname, subpath);
  return { element, dataType: null };
};
