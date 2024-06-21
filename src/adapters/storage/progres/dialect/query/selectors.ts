//
//  selectors.ts
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
import { _typeof, isPrimitive } from '../../../../../internals/schema';
import { CompileContext, QueryCompiler } from '../../../sql/compiler';
import { FieldSelectorExpression, QuerySelector } from '../../../../../server/query/dispatcher/parser';
import { _encodeJsonValue } from '../encode';
import { encodeType } from '../encode';
import { nullSafeEqual, nullSafeNotEqual } from '../basic';
import { fetchElement } from './utils';
import Decimal from 'decimal.js';
import { TObject } from '../../../../../internals/object';
import { _encodeValue } from '../../../../../internals/object';
import { TValue } from '../../../../../internals/types';

export const encodeFieldExpression = (
  compiler: QueryCompiler,
  context: CompileContext,
  parent: { className?: string; name: string; },
  field: string,
  expr: FieldSelectorExpression
): SQL => {
  const [colname] = _.toPath(field);
  const { element, json, dataType, relation } = fetchElement(compiler, parent, field);
  const encodeValue = (value: TValue) => dataType ? encodeType(colname, dataType, value) : _encodeJsonValue(_encodeValue(value));
  switch (expr.type) {
    case '$eq':
      {
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (_.isNil(expr.value)) return sql`${element} IS NULL`;
        if (!_.isString(dataType) && dataType?.type === 'pointer' && expr.value instanceof TObject && expr.value.objectId) {
          return sql`${element} ${nullSafeEqual()} ${{ value: expr.value.objectId }}`;
        }
        return sql`${element} ${nullSafeEqual()} ${encodeValue(expr.value)}`;
      }
    case '$ne':
      {
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (_.isNil(expr.value)) return sql`${element} IS NOT NULL`;
        if (!_.isString(dataType) && dataType?.type === 'pointer' && expr.value instanceof TObject && expr.value.objectId) {
          return sql`${element} ${nullSafeNotEqual()} ${{ value: expr.value.objectId }}`;
        }
        return sql`${element} ${nullSafeNotEqual()} ${encodeValue(expr.value)}`;
      }
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':
      {
        const operatorMap = {
          '$gt': '>',
          '$gte': '>=',
          '$lt': '<',
          '$lte': '<=',
        };
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (dataType && isPrimitive(dataType)) {
          switch (_typeof(dataType)) {
            case 'boolean':
              if (!_.isBoolean(expr.value)) break;
              return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`;
            case 'number':
            case 'decimal':
              if (!(expr.value instanceof Decimal) && !_.isNumber(expr.value)) break;
              return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`;
            case 'string':
              if (!_.isString(expr.value)) break;
              return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`;
            case 'date':
              if (!_.isDate(expr.value)) break;
              return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`;
            default: break;
          }
        } else if (!_.isString(dataType) && dataType?.type === 'pointer' && expr.value instanceof TObject && expr.value.objectId) {
          return sql`${element} ${{ literal: operatorMap[expr.type] }} ${{ value: expr.value.objectId }}`;
        } else if (!dataType) {
          if (expr.value instanceof Decimal || _.isNumber(expr.value)) {
            return sql`(
              jsonb_typeof(${element}) ${nullSafeEqual()} 'number'
              AND ${element}::NUMERIC ${{ literal: operatorMap[expr.type] }} ${{ value: expr.value instanceof Decimal ? expr.value.toNumber() : expr.value }}
            ) OR (
              jsonb_typeof(${element} -> '$decimal') ${nullSafeEqual()} 'string'
              AND (${element} ->> '$decimal')::DECIMAL ${{ literal: operatorMap[expr.type] }} ${{ value: expr.value instanceof Decimal ? expr.value.toString() : expr.value }}::DECIMAL
            )`;
          } else if (_.isDate(expr.value)) {
            return sql`(
              jsonb_typeof(${element} -> '$date') ${nullSafeEqual()} 'string'
              AND ${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}
            )`;
          } else {
            return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`;
          }
        }
      }
    case '$in':
      {
        if (!_.isArray(expr.value)) break;
        switch (expr.value.length) {
          case 0: return sql`false`;
          case 1:
            {
              const value = expr.value[0];
              if (!_.isString(dataType) && dataType?.type === 'pointer') {
                if (_.isNil(value)) return sql`${element} IS NULL`;
                if (!(value instanceof TObject) || !value.objectId) break;
                return sql`${element} ${nullSafeEqual()} ${{ value: value.objectId }}`;
              }
              return sql`${element} ${nullSafeEqual()} ${encodeValue(value)}`;
            }
          default:
            const containsNil = _.some(expr.value, x => _.isNil(x));
            const values = _.filter(expr.value, x => !_.isNil(x));
            if (!_.isString(dataType) && dataType?.type === 'pointer') {
              if (!_.every(values, x => x instanceof TObject && x.objectId)) break;
              if (containsNil) {
                return sql`${element} IS NULL OR ${element} IN (${_.map(values, (x: any) => sql`${{ value: x.objectId }}`)})`;
              }
              return sql`${element} IN (${_.map(values, (x: any) => sql`${{ value: x.objectId }}`)})`;
            }
            if (containsNil) {
              return sql`${element} IS NULL OR ${element} IN (${_.map(values, x => encodeValue(x))})`;
            }
            return sql`${element} IN (${_.map(values, x => encodeValue(x))})`;
        }
      }
    case '$nin':
      {
        if (!_.isArray(expr.value)) break;
        switch (expr.value.length) {
          case 0: return sql`true`;
          case 1:
            {
              const value = expr.value[0];
              if (!_.isString(dataType) && dataType?.type === 'pointer') {
                if (_.isNil(value)) return sql`${element} IS NOT NULL`;
                if (!(value instanceof TObject) || !value.objectId) break;
                return sql`${element} ${nullSafeNotEqual()} ${{ value: value.objectId }}`;
              }
              return sql`${element} ${nullSafeNotEqual()} ${encodeValue(value)}`;
            }
          default:
            const containsNil = _.some(expr.value, x => _.isNil(x));
            const values = _.filter(expr.value, x => !_.isNil(x));
            if (!_.isString(dataType) && dataType?.type === 'pointer') {
              if (!_.every(values, x => x instanceof TObject && x.objectId)) break;
              if (containsNil) {
                return sql`${element} IS NOT NULL AND ${element} NOT IN (${_.map(values, (x: any) => sql`${{ value: x.objectId }}`)})`;
              }
              return sql`${element} NOT IN (${_.map(values, (x: any) => sql`${{ value: x.objectId }}`)})`;
            }
            if (containsNil) {
              return sql`${element} IS NOT NULL AND ${element} NOT IN (${_.map(values, x => encodeValue(x))})`;
            }
            return sql`${element} NOT IN (${_.map(values, x => encodeValue(x))})`;
        }
      }
    case '$subset':
      {
        if (!_.isArray(expr.value)) break;
        if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`${element} <@ ${{ value: _encodeValue(expr.value) }}`;
        } else if (!_.isString(dataType) && dataType?.type === 'relation') {
          if (!_.every(expr.value, x => x instanceof TObject && x.objectId)) break;
          return sql`ARRAY(SELECT (UNNEST ->> '_id') FROM UNNEST(${element})) <@ ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.objectId }}`)}]`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND ${element} <@ ${_encodeJsonValue(_encodeValue(expr.value))}`;
        }
      }
    case '$superset':
      {
        if (!_.isArray(expr.value)) break;
        if (_.isEmpty(expr.value)) return sql`true`;
        if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`${element} @> ${{ value: _encodeValue(expr.value) }}`;
        } else if (!_.isString(dataType) && dataType?.type === 'relation') {
          if (!_.every(expr.value, x => x instanceof TObject && x.objectId)) break;
          return sql`ARRAY(SELECT (UNNEST ->> '_id') FROM UNNEST(${element})) @> ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.objectId }}`)}]`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND ${element} @> ${_encodeJsonValue(_encodeValue(expr.value))}`;
        }
      }
    case '$disjoint':
      {
        if (!_.isArray(expr.value)) break;
        if (_.isEmpty(expr.value)) return sql`true`;
        if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`NOT ${element} && ${{ value: _encodeValue(expr.value) }}`;
        } else if (!_.isString(dataType) && dataType?.type === 'relation') {
          if (!_.every(expr.value, x => x instanceof TObject && x.objectId)) break;
          return sql`NOT ARRAY(SELECT (UNNEST ->> '_id') FROM UNNEST(${element})) && ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.objectId }}`)}]`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND NOT ${element} && ${_encodeJsonValue(_encodeValue(expr.value))}`;
        }
      }
    case '$intersect':
      {
        if (!_.isArray(expr.value)) break;
        if (_.isEmpty(expr.value)) return sql`false`;
        if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`${element} && ${{ value: _encodeValue(expr.value) }}`;
        } else if (!_.isString(dataType) && dataType?.type === 'relation') {
          if (!_.every(expr.value, x => x instanceof TObject && x.objectId)) break;
          return sql`ARRAY(SELECT (UNNEST ->> '_id') FROM UNNEST(${element})) && ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.objectId }}`)}]`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND ${element} && ${_encodeJsonValue(_encodeValue(expr.value))}`;
        }
      }
    case '$not':
      {
        if (!(expr.value instanceof FieldSelectorExpression)) break;
        return sql`NOT (${encodeFieldExpression(compiler, context, parent, field, expr.value)})`;
      }
    case '$pattern':
      {
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          if (_.isString(expr.value)) {
            return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          } else if (_.isRegExp(expr.value)) {
            if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
            return sql`${element} ~ ${{ value: expr.value.source }}`;
          }
        } else if (!dataType) {
          if (_.isString(expr.value)) {
            return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          } else if (_.isRegExp(expr.value)) {
            if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
            return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') ~ ${{ value: expr.value.source }}`;
          }
        }
      }
    case '$starts':
      {
        if (!_.isString(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`${element} LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
        }
      }
    case '$ends':
      {
        if (!_.isString(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
        }
      }
    case '$size':
      {
        if (!_.isNumber(expr.value) || !_.isSafeInteger(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`COALESCE(length(${element}), 0) = ${{ value: expr.value }}`;
        } else if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'relation'))) {
          return sql`COALESCE(array_length(${element}, 1), 0) = ${{ value: expr.value }}`;
        } else if (!dataType) {
          return sql`(
            CASE jsonb_typeof(${element})
              WHEN 'array' THEN jsonb_array_length(${element}) = ${{ value: expr.value }}
              WHEN 'string' THEN length(${element} #>> '{}') = ${{ value: expr.value }}
              ELSE jsonb_typeof(${element}) IS NULL AND ${{ value: expr.value === 0 }}
            END
          )`;
        }
      }
    case '$empty':
      {
        if (!_.isBoolean(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`COALESCE(length(${element}), 0) ${{ literal: expr.value ? '=' : '<>' }} 0`;
        } else if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'relation'))) {
          return sql`COALESCE(array_length(${element}, 1), 0) ${{ literal: expr.value ? '=' : '<>' }} 0`;
        } else if (!dataType) {
          return sql`(
            CASE jsonb_typeof(${element})
              WHEN 'array' THEN jsonb_array_length(${element}) ${{ literal: expr.value ? '=' : '<>' }} 0
              WHEN 'string' THEN length(${element} #>> '{}') ${{ literal: expr.value ? '=' : '<>' }} 0
              ELSE jsonb_typeof(${element}) IS NULL AND ${{ value: expr.value }}
            END
          )`;
        }
      }
    case '$every':
      {
        if (!(expr.value instanceof QuerySelector)) break;

        const tempName = `_expr_$${compiler.nextIdx()}`;
        const filter = compiler._encodeFilter(context, { name: tempName, className: relation?.target }, expr.value);
        if (!filter) break;

        if (relation) {
          return sql`NOT EXISTS(
            SELECT * FROM (
              SELECT
                ${json ? sql`VALUE` : sql`UNNEST`} AS "$"
              FROM ${json ? sql`jsonb_array_elements(${element})` : sql`UNNEST(${element})`}
            ) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        } else if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`NOT EXISTS(
            SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND NOT EXISTS(
            SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        }
      }
    case '$some':
      {
        if (!(expr.value instanceof QuerySelector)) break;

        const tempName = `_expr_$${compiler.nextIdx()}`;
        const filter = compiler._encodeFilter(context, { name: tempName, className: relation?.target }, expr.value);
        if (!filter) break;

        if (relation) {
          return sql`EXISTS(
            SELECT * FROM (
              SELECT
                ${json ? sql`VALUE` : sql`UNNEST`} AS "$"
              FROM ${json ? sql`jsonb_array_elements(${element})` : sql`UNNEST(${element})`}
            ) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        } else if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`EXISTS(
            SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        } else if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND EXISTS(
            SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        }
      }
    default: break;
  }
  throw Error('Invalid expression');
};
