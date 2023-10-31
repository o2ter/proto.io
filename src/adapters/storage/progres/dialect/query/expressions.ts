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
import { TSchema, _typeof } from '../../../../../internals/schema';
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

const encodeTypedQueryExpression = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: { className?: string; name: string; },
  expr: QueryExpression
): [TSchema.Primitive, SQL] | undefined => {

  if (expr instanceof QueryKeyExpression) {
    const [colname, ...subpath] = _.toPath(expr.key);
    const dataType = parent.className && _.isEmpty(subpath) ? compiler.schema[parent.className].fields[colname] : null;
    const _dataType = dataType ? _typeof(dataType) : null;
    if (_dataType && ['boolean', 'number', 'decimal', 'string', 'date'].includes(_dataType)) {
      const element = fetchElement(compiler, parent, colname, subpath);
      return [_dataType as TSchema.Primitive, element];
    }
  }
  if (expr instanceof QueryValueExpression) {
    if (_.isBoolean(expr.value)) return ['boolean', sql`${{ value: expr.value }}`];
    if (_.isNumber(expr.value)) return ['number', sql`${{ value: expr.value }}`];
    if (expr.value instanceof Decimal) return ['decimal', sql`CAST(${{ quote: expr.value.toString() }} AS DECIMAL)`];
    if (_.isString(expr.value)) return ['string', sql`${{ value: expr.value }}`];
    if (_.isDate(expr.value)) return ['date', sql`${{ value: expr.value }}`];
  }
};

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

    if (expr.left instanceof QueryArrayExpression &&
      expr.right instanceof QueryArrayExpression &&
      expr.left.exprs.length === expr.right.exprs.length) {
      const _left = _.compact(_.map(expr.left.exprs, x => encodeTypedQueryExpression(compiler, context, parent, x)));
      const _right = _.compact(_.map(expr.right.exprs, x => encodeTypedQueryExpression(compiler, context, parent, x)));
      if (_left.length === expr.left.exprs.length &&
        _right.length === expr.right.exprs.length &&
        _.every(_.zip(_left, _right), ([l, r]) => l?.[0] === r?.[0])) {
        return sql`(${_.map(_left, x => x[1])}) ${operatorMap[expr.type]} (${_.map(_right, x => x[1])})`;
      }
    }

    const _left = encodeTypedQueryExpression(compiler, context, parent, expr.left);
    const _right = encodeTypedQueryExpression(compiler, context, parent, expr.right);
    if (_left && _right && _left[0] === _right[0]) {
      return sql`${_left[1]} ${operatorMap[expr.type]} ${_right[1]}`;
    }
  }
  if (expr instanceof QueryNotExpression) {
    const _expr = encodeQueryExpression(compiler, context, parent, expr.expr);
    return _expr ? sql`NOT (${_expr})` : undefined;
  }
  throw Error('Invalid expression');
};
