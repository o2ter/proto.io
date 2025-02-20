//
//  index.ts
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
import { SQL, sql } from '../../../../sql';
import { _typeof, isPrimitive } from '../../../../../../internals/schema';
import { QueryCompiler, QueryContext } from '../../../../sql/compiler';
import { nullSafeEqual, nullSafeNotEqual } from '../../basic';
import {
  QueryArrayExpression,
  QueryBinaryExpression,
  QueryCoditionalExpression,
  QueryComparisonExpression,
  QueryCondExpression,
  QueryDistanceExpression,
  QueryExpression,
  QueryKeyExpression,
  QueryListExpression,
  QueryZeroParamExpression,
  QueryNotExpression,
  QuerySwitchExpression,
  QueryUnaryExpression,
  QueryValueExpression
} from '../../../../../../server/query/dispatcher/parser/expressions';
import { fetchElement } from '../utils';
import { _encodeJsonValue } from '../../encode';
import Decimal from 'decimal.js';
import { _encodeValue } from '../../../../../../internals/object';
import { encodeDistanceQueryExpression } from './vector';
import { PrimitiveValue, _PrimitiveValue, isArrayExpr, arrayLength, mapExpr, TypedSQL, zipExpr } from './types';

export const encodeTypedQueryExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  expr: QueryExpression
): TypedSQL | undefined => {

  if (expr instanceof QueryKeyExpression) {
    const { element, dataType } = fetchElement(compiler, parent, expr.key);
    const _dataType = dataType ? _typeof(dataType) : null;
    if (_dataType && _PrimitiveValue.includes(_dataType as any)) {
      return { type: _dataType as PrimitiveValue, sql: element };
    }
  }
  if (expr instanceof QueryValueExpression) {
    if (_.isBoolean(expr.value)) return { type: 'boolean', sql: sql`${{ value: expr.value }}` };
    if (_.isNumber(expr.value)) return { type: 'number', sql: sql`${{ value: expr.value }}` };
    if (expr.value instanceof Decimal) return { type: 'decimal', sql: sql`CAST(${{ quote: expr.value.toString() }} AS DECIMAL)` };
    if (_.isString(expr.value)) return { type: 'string', sql: sql`${{ value: expr.value }}` };
    if (_.isDate(expr.value)) return { type: 'date', sql: sql`${{ value: expr.value }}` };
  }
  if (
    expr instanceof QueryCoditionalExpression ||
    expr instanceof QueryComparisonExpression ||
    expr instanceof QueryNotExpression
  ) {
    const value = encodeBooleanExpression(compiler, parent, expr);
    if (value) return { type: 'boolean', sql: value };
  }

  if (expr instanceof QueryDistanceExpression) {
    const value = encodeDistanceQueryExpression(compiler, parent, expr);
    return { type: 'number', sql: value };
  }

  if (expr instanceof QueryZeroParamExpression) {
    switch (expr.type) {
      case '$rand': return { type: 'number', sql: sql`RANDOM()` };
      case '$now': return { type: 'date', sql: sql`CAST(NOW() AS TIMESTAMP(3) WITH TIME ZONE)` };
    }
  }

  if (expr instanceof QueryUnaryExpression) {
  }

  if (expr instanceof QueryBinaryExpression) {
    const left = encodeTypedQueryExpression(compiler, parent, expr.left);
    const right = encodeTypedQueryExpression(compiler, parent, expr.right);
    if (left && right) {
      switch (expr.type) {
        case '$mod':
        case '$log':
        case '$pow':
        case '$trunc':
        case '$atan2':
          {
            const op = {
              '$mod': 'MOD',
              '$log': 'LOG',
              '$pow': 'POWER',
              '$trunc': 'TRUNC',
              '$atan2': 'ATAN2',
            }[expr.type];
            if (left.type === right.type) {
              return { type: left.type, sql: sql`${{ literal: op }}((${left.sql}), (${right.sql}))` };
            }
            if (left.type === 'decimal' && right.type === 'number') {
              return { type: 'decimal', sql: sql`${{ literal: op }}((${left.sql}), CAST((${right.sql}) AS DECIMAL))` };
            }
            if (left.type === 'number' && right.type === 'decimal') {
              return { type: 'decimal', sql: sql`${{ literal: op }}(CAST((${left.sql}) AS DECIMAL), (${right.sql}))` };
            }
          }
          break;
        case '$divide':
        case '$subtract':
          {
            const op = {
              '$divide': '/',
              '$subtract': '-',
            }[expr.type];
            if (left.type === right.type) {
              return { type: left.type, sql: sql`(${left.sql}) ${{ literal: op }} (${right.sql})` };
            }
            if (left.type === 'decimal' && right.type === 'number') {
              return { type: 'decimal', sql: sql`CAST((${left.sql}) AS DECIMAL) ${{ literal: op }} (${right.sql})` };
            }
            if (left.type === 'number' && right.type === 'decimal') {
              return { type: 'decimal', sql: sql`(${left.sql}) ${{ literal: op }} CAST((${right.sql}) AS DECIMAL)` };
            }
          }
          break;
      }
    }
  }

  if (expr instanceof QueryListExpression) {
    const values = _.compact(_.map(expr.exprs, x => encodeTypedQueryExpression(compiler, parent, x)));
    if (values.length === expr.exprs.length) {
      switch (expr.type) {
        case '$add':
        case '$multiply':
          {
            const op = {
              '$add': '+',
              '$multiply': '*',
            }[expr.type];
            if (_.every(values, x => x.type === 'number')) {
              return { type: 'number', sql: sql`${{ literal: _.map(values, x => x.sql), separator: ` ${op} ` }}` };
            }
            if (_.every(values, x => x.type === 'number' || x.type === 'decimal')) {
              return { type: 'decimal', sql: sql`${{ literal: _.map(values, x => x.type === 'decimal' ? x.sql : sql`CAST((${x.sql}) AS DECIMAL)`), separator: ` ${op} ` }}` };
            }
          }
          break;
        case '$ifNull':
          {
            const type = values[0].type;
            if (_.every(values, x => x.type === type)) {
              
            }
          }
          break;
        case '$concat':
          {
          }
          break;
      }
    }
  }

  if (expr instanceof QueryCondExpression) {
  }

  if (expr instanceof QuerySwitchExpression) {
  }
};

const encodeJsonQueryExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  expr: QueryExpression
): SQL => {

  if (expr instanceof QueryKeyExpression) {
    const { element, dataType } = fetchElement(compiler, parent, expr.key);
    if (dataType && isPrimitive(dataType)) {
      switch (_typeof(dataType)) {
        case 'boolean': return sql`to_jsonb(${element})`;
        case 'number': return sql`to_jsonb(${element})`;
        case 'decimal': return sql`jsonb_build_object('$decimal', CAST(${element} AS TEXT))`;
        case 'string': return sql`to_jsonb(${element})`;
        case 'string[]': return sql`to_jsonb(${element})`;
        case 'date': return sql`jsonb_build_object(
          '$date', to_char(${element} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )`;
        default: break;
      }
    }
    return sql`${element}`;
  }
  if (expr instanceof QueryValueExpression) {
    return _encodeJsonValue(_encodeValue(expr.value));
  }
  if (expr instanceof QueryArrayExpression) {
    return sql`jsonb_build_array(${_.map(expr.exprs, x => encodeJsonQueryExpression(compiler, parent, x))})`;
  }

  const typed = encodeTypedQueryExpression(compiler, parent, expr);
  if (!typed) throw Error('Invalid expression');
  switch (typed.type) {
    case 'boolean': return sql`to_jsonb(${typed.sql})`;
    case 'number': return sql`to_jsonb(${typed.sql})`;
    case 'decimal': return sql`jsonb_build_object('$decimal', CAST(${typed.sql} AS TEXT))`;
    case 'string': return sql`to_jsonb(${typed.sql})`;
    case 'date': return sql`jsonb_build_object(
      '$date', to_char(${typed.sql} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )`;
    default: throw Error('Invalid expression');
  }
};

export const encodeBooleanExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  expr: QueryExpression
): SQL | undefined => {

  if (expr instanceof QueryCoditionalExpression) {
    const queries = _.compact(_.map(expr.exprs, x => encodeBooleanExpression(compiler, parent, x)));
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
      isArrayExpr(expr.left) &&
      isArrayExpr(expr.right) &&
      arrayLength(expr.left) === arrayLength(expr.right)
    ) {
      const _left = mapExpr(expr.left, x => encodeTypedQueryExpression(compiler, parent, x));
      const _right = mapExpr(expr.right, x => encodeTypedQueryExpression(compiler, parent, x));
      const zipped = zipExpr(_left, _right) ?? [];
      if (_left.length === zipped.length) {
        const [l, r] = _.unzip(zipped);
        return sql`(${_.map(l, x => x.sql)}) ${operatorMap[expr.type]} (${_.map(r, x => x.sql)})`;
      }
    }

    const _left = encodeTypedQueryExpression(compiler, parent, expr.left);
    const _right = encodeTypedQueryExpression(compiler, parent, expr.right);
    if (_left && _right) {
      if (_left.type === _right.type) {
        return sql`(${_left.sql}) ${operatorMap[expr.type]} (${_right.sql})`;
      }
      if (_left.type === 'decimal' && _right.type === 'number') {
        return sql`CAST((${_left.sql}) AS DOUBLE PRECISION) ${operatorMap[expr.type]} (${_right.sql})`;
      }
      if (_left.type === 'number' && _right.type === 'decimal') {
        return sql`(${_left.sql}) ${operatorMap[expr.type]} CAST((${_right.sql}) AS DOUBLE PRECISION)`;
      }
    }

    const _left2 = encodeJsonQueryExpression(compiler, parent, expr.left);
    const _right2 = encodeJsonQueryExpression(compiler, parent, expr.right);
    return sql`${_left2} ${operatorMap[expr.type]} ${_right2}`;
  }
  if (expr instanceof QueryNotExpression) {
    const _expr = encodeBooleanExpression(compiler, parent, expr.expr);
    return _expr ? sql`NOT (${_expr})` : undefined;
  }
  throw Error('Invalid expression');
};
