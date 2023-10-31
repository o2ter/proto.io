//
//  expressions.ts
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
import { SQL, sql } from '../../../../../server/sql';
import { Decimal } from '../../../../../internals';
import { _typeof } from '../../../../../internals/schema';
import { CompileContext, QueryCompiler } from '../../../../../server/sql/compiler';
import { nullSafeEqual, nullSafeNotEqual } from '../basic';
import {
  QueryArrayExpression,
  QueryCoditionalExpression,
  QueryComparisonExpression,
  QueryExpression,
  QueryKeyExpression,
  QueryNotExpression,
  QueryValueExpression
} from '../../../../../server/query/validator/parser/expressions';
import { fetchElement } from './utils';

const isValueExpression = (expr: QueryExpression): boolean => {
  if (expr instanceof QueryArrayExpression) return _.every(expr.exprs, x => isValueExpression(x));
  return expr instanceof QueryValueExpression;
}
const isArrayExpression = (expr: QueryExpression) => {
  if (expr instanceof QueryArrayExpression) return true;
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value);
  return false;
}
const arrayLength = (expr: QueryExpression) => {
  if (expr instanceof QueryArrayExpression) return expr.exprs.length;
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value) ? expr.value.length : 0;
  return 0;
}
const mapExpression = <R>(expr: QueryExpression, callback: (x: QueryExpression) => R): R[] => {
  if (expr instanceof QueryArrayExpression) return _.map(expr.exprs, x => callback(x));
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value) ? _.map(expr.value, x => callback(new QueryValueExpression(x))) : [];
  return [];
}

const _PrimitiveValue = ['boolean', 'number', 'decimal', 'string', 'date'] as const;
type PrimitiveValue = typeof _PrimitiveValue[number];

const encodeTypedQueryExpression = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: { className?: string; name: string; },
  expr: QueryExpression
): { type: PrimitiveValue; sql: SQL }[] | undefined => {

  if (expr instanceof QueryKeyExpression) {
    const [colname, ...subpath] = _.toPath(expr.key);
    const dataType = parent.className && _.isEmpty(subpath) ? compiler.schema[parent.className].fields[colname] : null;
    const _dataType = dataType ? _typeof(dataType) : null;
    if (_dataType && _PrimitiveValue.includes(_dataType as any)) {
      const element = fetchElement(compiler, parent, colname, subpath);
      return [{ type: _dataType as PrimitiveValue, sql: element }];
    }
  }
  if (expr instanceof QueryValueExpression) {
    if (_.isBoolean(expr.value)) return [{ type: 'boolean', sql: sql`${{ value: expr.value }}` }];
    if (_.isNumber(expr.value)) return [
      { type: 'number', sql: sql`${{ value: expr.value }}` },
      { type: 'decimal', sql:  sql`CAST(${{ quote: (new Decimal(expr.value)).toString() }} AS DECIMAL)` },
    ];
    if (expr.value instanceof Decimal) return [
      { type: 'decimal', sql: sql`CAST(${{ quote: expr.value.toString() }} AS DECIMAL)` },
      { type: 'number', sql: sql`${{ value: expr.value.toNumber() }}` },
    ];
    if (_.isString(expr.value)) return [{ type: 'string', sql: sql`${{ value: expr.value }}` }];
    if (_.isDate(expr.value)) return [{ type: 'date', sql: sql`${{ value: expr.value }}` }];
  }
};

const matchType = (
  first: { type: PrimitiveValue; sql: SQL }[] | undefined, 
  second: { type: PrimitiveValue; sql: SQL }[] | undefined,
): [{ type: PrimitiveValue; sql: SQL }, { type: PrimitiveValue; sql: SQL }] | undefined => {
  const found = _.find(first, l => _.some(second, r => l.type === r.type));
  return found ? [found, _.find(second, r => r.type === found.type)!] : undefined;
}

export const encodeQueryExpression = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: { className?: string; name: string; },
  expr: QueryExpression
): SQL | undefined => {

  if (expr instanceof QueryCoditionalExpression) {
    const queries = _.compact(_.map(expr.exprs, x => encodeQueryExpression(compiler, context, parent, x)));
    if (_.isEmpty(queries)) return;
    switch (expr.type) {
      case '$and': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }})`;
      case '$nor': return sql`(${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }})`;
      case '$or': return sql`(${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }})`;
      default: break;
    }
  }
  if (expr instanceof QueryComparisonExpression) {

    const operatorMap = {
      '$eq': nullSafeEqual(),
      '$ne': nullSafeNotEqual(),
      '$gt': sql`>`,
      '$gte': sql`>=`,
      '$lt': sql`<`,
      '$lte': sql`<=`,
    };

    if (
      isArrayExpression(expr.left) &&
      isArrayExpression(expr.right) &&
      arrayLength(expr.left) === arrayLength(expr.right)
    ) {
      const _left = mapExpression(expr.left, x => encodeTypedQueryExpression(compiler, context, parent, x));
      const _right = mapExpression(expr.right, x => encodeTypedQueryExpression(compiler, context, parent, x));
      const mapped = _.compact(_.map(_.zip(_left, _right), ([l, r]) => matchType(l, r)));
      if (mapped.length === _left.length) {
        const [l, r] = _.unzip(mapped);
        return sql`(${_.map(l, x => x.sql)}) ${operatorMap[expr.type]} (${_.map(r, x => x.sql)})`;
      }
    }

    const _left = encodeTypedQueryExpression(compiler, context, parent, expr.left);
    const _right = encodeTypedQueryExpression(compiler, context, parent, expr.right);
    if (_left && _right) {
      const matched = matchType(_left, _right);
      if (matched) return sql`${matched[0].sql} ${operatorMap[expr.type]} ${matched[1].sql}`;
    }
  }
  if (expr instanceof QueryNotExpression) {
    const _expr = encodeQueryExpression(compiler, context, parent, expr.expr);
    return _expr ? sql`NOT (${_expr})` : undefined;
  }
  throw Error('Invalid expression');
};
