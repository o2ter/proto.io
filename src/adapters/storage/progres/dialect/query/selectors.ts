//
//  selectors.ts
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
import { SQL, sql } from '../../../sql';
import { _typeof, isPrimitive } from '../../../../../internals/schema';
import { Populate, QueryCompiler } from '../../../sql/compiler';
import { FieldSelectorExpression, QuerySelector } from '../../../../../server/query/dispatcher/parser';
import { _encodeJsonValue } from '../encode';
import { encodeType } from '../encode';
import { nullSafeEqual, nullSafeNotEqual } from '../basic';
import { fetchElement } from './utils';
import Decimal from 'decimal.js';
import { TObject } from '../../../../../internals/object';
import { _encodeValue } from '../../../../../internals/object';
import { TValue } from '../../../../../internals/types';
import { _selectRelationPopulate } from '../populate';

export const encodeFieldExpression = (
  compiler: QueryCompiler,
  parent: { className?: string; name: string; populates?: Record<string, Populate>; },
  field: string,
  expr: FieldSelectorExpression
): SQL => {
  const [colname] = _.toPath(field);
  const { element, dataType, relation } = fetchElement(compiler, parent, field);
  const encodeValue = (value: TValue) => dataType ? encodeType(colname, dataType, value) : _encodeJsonValue(_encodeValue(value));
  switch (expr.type) {
    case '$eq':
      {
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (_.isNil(expr.value)) return sql`${element} IS NULL`;
        if (!_.isString(dataType) && dataType?.type === 'pointer') {
          if (!(expr.value instanceof TObject) || dataType.target !== expr.value.className || !expr.value.objectId) break;
          return sql`${element} ${nullSafeEqual()} ${{ value: expr.value.objectId }}`;
        }
        return sql`${element} ${nullSafeEqual()} ${encodeValue(expr.value)}`;
      }
    case '$ne':
      {
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (_.isNil(expr.value)) return sql`${element} IS NOT NULL`;
        if (!_.isString(dataType) && dataType?.type === 'pointer') {
          if (!(expr.value instanceof TObject) || dataType.target !== expr.value.className || !expr.value.objectId) break;
          return sql`${element} ${nullSafeNotEqual()} ${{ value: expr.value.objectId }}`;
        }
        return sql`${element} ${nullSafeNotEqual()} ${encodeValue(expr.value)}`;
      }
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':
      {
        const op = {
          '$gt': '>',
          '$gte': '>=',
          '$lt': '<',
          '$lte': '<=',
        }[expr.type];
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        if (dataType && isPrimitive(dataType)) {
          switch (_typeof(dataType)) {
            case 'boolean':
              if (!_.isBoolean(expr.value)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            case 'number':
            case 'decimal':
              if (!(expr.value instanceof Decimal) && !_.isNumber(expr.value)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            case 'string':
              if (!_.isString(expr.value)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            case 'date':
              if (!_.isDate(expr.value)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            default: break;
          }
        } else if (!_.isString(dataType) && dataType?.type === 'pointer' && expr.value instanceof TObject && expr.value.objectId) {
          return sql`${element} ${{ literal: op }} ${{ value: expr.value.objectId }}`;
        } else if (!dataType) {
          if (expr.value instanceof Decimal || _.isNumber(expr.value)) {
            return sql`(
              jsonb_typeof(${element}) ${nullSafeEqual()} 'number'
              AND ${element}::NUMERIC ${{ literal: op }} ${{ value: expr.value instanceof Decimal ? expr.value.toNumber() : expr.value }}
            ) OR (
              jsonb_typeof(${element} -> '$decimal') ${nullSafeEqual()} 'string'
              AND (${element} ->> '$decimal')::DECIMAL ${{ literal: op }} ${{ value: expr.value instanceof Decimal ? expr.value.toString() : expr.value }}::DECIMAL
            )`;
          } else if (_.isDate(expr.value)) {
            return sql`(
              jsonb_typeof(${element} -> '$date') ${nullSafeEqual()} 'string'
              AND ${element} ${{ literal: op }} ${encodeValue(expr.value)}
            )`;
          } else {
            return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
          }
        }
      }
      break;
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
                if (!(value instanceof TObject) || dataType.target !== value.className || !value.objectId) break;
                return sql`${element} ${nullSafeEqual()} ${{ value: value.objectId }}`;
              }
              return sql`${element} ${nullSafeEqual()} ${encodeValue(value)}`;
            }
          default:
            const containsNil = _.some(expr.value, x => _.isNil(x));
            const values = _.filter(expr.value, x => !_.isNil(x));
            if (!_.isString(dataType) && dataType?.type === 'pointer') {
              if (!_.every(values, x => x instanceof TObject && dataType.target === x.className && x.objectId)) break;
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
      break;
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
                if (!(value instanceof TObject) || dataType.target !== value.className || !value.objectId) break;
                return sql`${element} ${nullSafeNotEqual()} ${{ value: value.objectId }}`;
              }
              return sql`${element} ${nullSafeNotEqual()} ${encodeValue(value)}`;
            }
          default:
            const containsNil = _.some(expr.value, x => _.isNil(x));
            const values = _.filter(expr.value, x => !_.isNil(x));
            if (!_.isString(dataType) && dataType?.type === 'pointer') {
              if (!_.every(values, x => x instanceof TObject && dataType.target === x.className && x.objectId)) break;
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
      break;
    case '$subset':
    case '$superset':
    case '$intersect':
      {
        const op = {
          '$subset': '<@',
          '$superset': '@>',
          '$intersect': '&&',
        }[expr.type];
        if (!_.isArray(expr.value)) break;
        if (_.isEmpty(expr.value)) {
          switch (expr.type) {
            case '$superset': return sql`true`;
            case '$intersect': return sql`false`;
            default: break;
          }
        }
        if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
          return sql`${element} ${{ literal: op }} ${{ value: _encodeValue(expr.value) }}`;
        }
        if (relation && parent.className) {
          if (!_.every(expr.value, x => x instanceof TObject && relation.target === x.className && x.objectId)) break;
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`ARRAY(
            SELECT ${{ identifier: '_id' }}
            FROM (${populate}) AS ${{ identifier: tempName }}
          ) ${{ literal: op }} ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.objectId }}`)}]::TEXT[]`;
        }
        if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND ${element} ${{ literal: op }} ${_encodeJsonValue(_encodeValue(expr.value))}`;
        }
      }
      break;
    case '$not':
      {
        if (!(expr.value instanceof FieldSelectorExpression)) break;
        return sql`NOT (${encodeFieldExpression(compiler, parent, field, expr.value)})`;
      }
    case '$pattern':
      {
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          if (_.isString(expr.value)) {
            return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          }
          if (_.isRegExp(expr.value)) {
            if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
            return sql`${element} ~ ${{ value: expr.value.source }}`;
          }
        } else if (!dataType) {
          if (_.isString(expr.value)) {
            return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          }
          if (_.isRegExp(expr.value)) {
            if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
            return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') ~ ${{ value: expr.value.source }}`;
          }
        }
      }
      break;
    case '$starts':
      {
        if (!_.isString(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`${element} LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
        }
        if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
        }
      }
      break;
    case '$ends':
      {
        if (!_.isString(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
        }
        if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
        }
      }
      break;
    case '$size':
      {
        if (!_.isNumber(expr.value) || !_.isSafeInteger(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`COALESCE(length(${element}), 0) = ${{ value: expr.value }}`;
        }
        if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'vector' || dataType?.type === 'relation'))) {
          return sql`COALESCE(array_length(${element}, 1), 0) = ${{ value: expr.value }}`;
        }
        if (!dataType) {
          return sql`(
            CASE jsonb_typeof(${element})
              WHEN 'array' THEN jsonb_array_length(${element}) = ${{ value: expr.value }}
              WHEN 'string' THEN length(${element} #>> '{}') = ${{ value: expr.value }}
              ELSE jsonb_typeof(${element}) IS NULL AND ${{ value: expr.value === 0 }}
            END
          )`;
        }
      }
      break;
    case '$empty':
      {
        if (!_.isBoolean(expr.value)) break;
        if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
          return sql`COALESCE(length(${element}), 0) ${{ literal: expr.value ? '=' : '<>' }} 0`;
        }
        if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'vector' || dataType?.type === 'relation'))) {
          return sql`COALESCE(array_length(${element}, 1), 0) ${{ literal: expr.value ? '=' : '<>' }} 0`;
        }
        if (!dataType) {
          return sql`(
            CASE jsonb_typeof(${element})
              WHEN 'array' THEN jsonb_array_length(${element}) ${{ literal: expr.value ? '=' : '<>' }} 0
              WHEN 'string' THEN length(${element} #>> '{}') ${{ literal: expr.value ? '=' : '<>' }} 0
              ELSE jsonb_typeof(${element}) IS NULL AND ${{ value: expr.value }}
            END
          )`;
        }
      }
      break;
    case '$every':
      {
        if (!(expr.value instanceof QuerySelector)) break;

        if (relation && parent.className) {
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const filter = compiler._encodeFilter({
            name: tempName,
            className: relation.target,
            populates: relation.populate.populates,
          }, expr.value);
          if (!filter) break;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`NOT EXISTS(
            SELECT * FROM (${populate}) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        }

        const tempName = `_doller_expr_$${compiler.nextIdx()}`;
        const filter = compiler._encodeFilter({ name: tempName, className: relation?.target }, expr.value);
        if (!filter) break;

        if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'vector'))) {
          return sql`NOT EXISTS(
            SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        }
        if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND NOT EXISTS(
            SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
            WHERE NOT (${filter})
          )`;
        }
      }
      break;
    case '$some':
      {
        if (!(expr.value instanceof QuerySelector)) break;

        if (relation && parent.className) {
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const filter = compiler._encodeFilter({
            name: tempName,
            className: relation.target,
            populates: relation.populate.populates,
           }, expr.value);
          if (!filter) break;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`EXISTS(
            SELECT * FROM (${populate}) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        }

        const tempName = `_doller_expr_$${compiler.nextIdx()}`;
        const filter = compiler._encodeFilter({ name: tempName, className: relation?.target }, expr.value);
        if (!filter) break;

        if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'vector'))) {
          return sql`EXISTS(
            SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        }
        if (!dataType) {
          return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND EXISTS(
            SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
            WHERE ${filter}
          )`;
        }
      }
      break;
    default: break;
  }
  throw Error('Invalid expression');
};
