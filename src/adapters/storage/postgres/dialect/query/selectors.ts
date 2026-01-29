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
import { _isTypeof, _typeof, isPrimitive, TSchema } from '../../../../../internals/schema';
import { QueryCompiler, QueryContext } from '../../../sql/compiler';
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

// Helper: Check if value is a valid pointer with ID
const isValidPointer = (value: any, targetClass?: string): value is TObject => {
  return value instanceof TObject
    && (!targetClass || targetClass === value.className)
    && !!value.id;
};

// Helper: Handle equality/inequality comparison for pointers and regular values
const handleComparison = (
  element: SQL,
  value: any,
  dataType: any,
  isEqual: boolean,
  encodeValue?: (v: any) => SQL
): SQL | null => {
  if (_.isNil(value)) {
    return sql`${element} IS ${isEqual ? sql`NULL` : sql`NOT NULL`}`;
  }

  if (!_.isString(dataType) && dataType?.type === 'pointer') {
    if (!isValidPointer(value, dataType.target)) return null;
    const op = isEqual ? nullSafeEqual() : nullSafeNotEqual();
    return sql`${element} ${op} ${{ value: value.id }}`;
  }

  if (encodeValue) {
    const op = isEqual ? nullSafeEqual() : nullSafeNotEqual();
    return sql`${element} ${op} ${encodeValue(value)}`;
  }

  return null;
};

// Helper: Handle $in/$nin operators
const handleInComparison = (
  element: SQL,
  values: any[],
  dataType: any,
  isNegated: boolean,
  encodeValue: (v: any) => SQL
): SQL | null => {
  if (values.length === 0) {
    return sql`${{ literal: isNegated ? 'true' : 'false' }}`;
  }

  if (values.length === 1) {
    return handleComparison(element, values[0], dataType, !isNegated, encodeValue);
  }

  const containsNil = _.some(values, x => _.isNil(x));
  const nonNilValues = _.filter(values, x => !_.isNil(x));

  // Handle pointer types
  if (!_.isString(dataType) && dataType?.type === 'pointer') {
    if (!_.every(nonNilValues, x => isValidPointer(x, dataType.target))) return null;
    const inList = _.map(nonNilValues, (x: any) => sql`${{ value: x.id }}`);
    const inClause = isNegated ? sql`${element} NOT IN (${inList})` : sql`${element} IN (${inList})`;

    if (containsNil) {
      return isNegated
        ? sql`${element} IS NOT NULL AND ${inClause}`
        : sql`${element} IS NULL OR ${inClause}`;
    }
    return inClause;
  }

  // Handle non-pointer types
  const encodedValues = _.map(nonNilValues, x => encodeValue(x));
  const inClause = isNegated ? sql`${element} NOT IN (${encodedValues})` : sql`${element} IN (${encodedValues})`;

  if (containsNil) {
    return isNegated
      ? sql`${element} IS NOT NULL AND ${inClause}`
      : sql`${element} IS NULL OR ${inClause}`;
  }
  return inClause;
};

// Helper function to handle string pattern matching
const encodeStringPattern = (
  element: SQL,
  dataType: TSchema.DataType | null,
  pattern: string | RegExp,
  mode: 'contains' | 'starts' | 'ends'
): SQL | null => {
  const isTypedString = dataType && _isTypeof(dataType, 'string');

  if (_.isString(pattern)) {
    const escaped = pattern.replace(/([\\_%])/g, '\\$1');
    const likePattern = mode === 'contains'
      ? `%${escaped}%`
      : mode === 'starts'
        ? `${escaped}%`
        : `%${escaped}`;

    if (isTypedString) {
      return sql`${element} LIKE ${{ value: likePattern }}`;
    }
    if (!dataType) {
      return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: likePattern }}`;
    }
  }

  if (_.isRegExp(pattern)) {
    const regexOp = pattern.ignoreCase ? '~*' : '~';
    if (isTypedString) {
      return sql`${element} ${{ literal: regexOp }} ${{ value: pattern.source }}`;
    }
    if (!dataType) {
      return pattern.ignoreCase
        ? sql`${element} ~* ${{ value: pattern.source }}`
        : sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'string' AND (${element} #>> '{}') ~ ${{ value: pattern.source }}`;
    }
  }

  return null;
};

// Helper function to handle $every and $some operators
const encodeArrayQuantifier = (
  compiler: QueryCompiler,
  parent: QueryContext,
  field: string,
  element: SQL,
  dataType: TSchema.DataType | null,
  relation: any,
  selector: QuerySelector,
  quantifier: 'every' | 'some'
): SQL | null => {
  const exists = quantifier === 'some' ? 'EXISTS' : 'NOT EXISTS';
  const filterNegate = quantifier === 'every' ? 'NOT ' : '';

  if (relation && parent.className) {
    const tempName = `_populate_expr_$${compiler.nextIdx()}`;
    const filter = compiler._encodeFilter({
      name: tempName,
      className: relation.target,
      populates: relation.populate.populates,
    }, selector);
    if (!filter) throw Error('Invalid expression');

    const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
    return sql`${sql`${{ literal: exists }}`}(
      SELECT * FROM (${populate}) AS ${{ identifier: tempName }}
      WHERE ${sql`${{ literal: filterNegate }}`}(${filter})
    )`;
  }

  const mapping = {
    'vector': '_doller_num_expr_$',
    'string[]': '_doller_str_expr_$',
  };

  for (const [key, value] of _.entries(mapping)) {
    if (dataType && _isTypeof(dataType, key)) {
      const tempName = `${value}${compiler.nextIdx()}`;
      const filter = compiler._encodeFilter({ name: tempName, className: relation?.target }, selector);
      if (!filter) throw Error('Invalid expression');

      return sql`${sql`${{ literal: exists }}`}(
        SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
        WHERE ${sql`${{ literal: filterNegate }}`}(${filter})
      )`;
    }
  }

  const tempName = `_doller_expr_$${compiler.nextIdx()}`;
  const filter = compiler._encodeFilter({ name: tempName, className: relation?.target }, selector);
  if (!filter) throw Error('Invalid expression');

  if (dataType && _isTypeof(dataType, 'array')) {
    return sql`${sql`${{ literal: exists }}`}(
      SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
      WHERE ${sql`${{ literal: filterNegate }}`}(${filter})
    )`;
  }

  if (!dataType) {
    return sql`jsonb_typeof(${element}) ${nullSafeEqual()} 'array' AND ${sql`${{ literal: exists }}`}(
      SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
      WHERE ${sql`${{ literal: filterNegate }}`}(${filter})
    )`;
  }

  return null;
};

export const encodeFieldExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  field: string,
  expr: FieldSelectorExpression
): SQL => {
  const [colname] = _.toPath(field);
  const { element, dataType, relation } = fetchElement(compiler, parent, field);
  const encodeValue = (value: TValue) => dataType ? encodeType(colname, dataType, value) : _encodeJsonValue(_encodeValue(value));

  switch (expr.type) {
    case '$eq':
    case '$ne':
      {
        if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldSelectorExpression) break;
        const result = handleComparison(element, expr.value, dataType, expr.type === '$eq', encodeValue);
        if (result) return result;
      }
      break;
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
            case 'string[]':
              if (!_.isArray(expr.value) || !_.every(expr.value, _.isString)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            case 'date':
              if (!_.isDate(expr.value)) break;
              return sql`${element} ${{ literal: op }} ${encodeValue(expr.value)}`;
            default: break;
          }
        } else if (!_.isString(dataType) && dataType?.type === 'pointer' && expr.value instanceof TObject && expr.value.id) {
          return sql`${element} ${{ literal: op }} ${{ value: expr.value.id }}`;
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
    case '$nin':
      {
        if (!_.isArray(expr.value)) break;
        const result = handleInComparison(element, expr.value, dataType, expr.type === '$nin', encodeValue);
        if (result) return result;
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
        if (dataType && _isTypeof(dataType, ['array', 'string[]'])) {
          return sql`${element} ${{ literal: op }} ${{ value: _encodeValue(expr.value) }}`;
        }
        if (relation && parent.className) {
          if (!_.every(expr.value, x => x instanceof TObject && relation.target === x.className && x.id)) break;
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`ARRAY(
            SELECT ${{ identifier: '_id' }}
            FROM (${populate}) AS ${{ identifier: tempName }}
          ) ${{ literal: op }} ARRAY[${_.map(expr.value, (x: any) => sql`${{ value: x.id }}`)}]::TEXT[]`;
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
        if (_.isString(expr.value) || _.isRegExp(expr.value)) {
          const result = encodeStringPattern(element, dataType, expr.value, 'contains');
          if (result) return result;
        }
      }
      break;
    case '$starts':
      {
        if (!_.isString(expr.value)) break;
        const result = encodeStringPattern(element, dataType, expr.value, 'starts');
        if (result) return result;
      }
      break;
    case '$ends':
      {
        if (!_.isString(expr.value)) break;
        const result = encodeStringPattern(element, dataType, expr.value, 'ends');
        if (result) return result;
      }
      break;
    case '$size':
      {
        if (!_.isNumber(expr.value) || !_.isSafeInteger(expr.value)) break;
        if (dataType && _isTypeof(dataType, 'string')) {
          return sql`COALESCE(length(${element}), 0) = ${{ value: expr.value }}`;
        }
        if (relation && parent.className && parent.groupMatches?.[colname]) {
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`(SELECT COUNT(*) FROM (${populate}) AS ${{ identifier: tempName }}) = ${{ value: expr.value }}`;
        }
        if (dataType && _isTypeof(dataType, ['array', 'string[]', 'vector', 'relation'])) {
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
        if (dataType && _isTypeof(dataType, 'string')) {
          return sql`COALESCE(length(${element}), 0) ${{ literal: expr.value ? '=' : '<>' }} 0`;
        }
        if (relation && parent.className && parent.groupMatches?.[colname]) {
          const tempName = `_populate_expr_$${compiler.nextIdx()}`;
          const populate = _selectRelationPopulate(compiler, { className: parent.className, name: parent.name }, relation.populate, `$${field}`, false);
          return sql`${{ literal: expr.value ? 'NOT EXISTS' : 'EXISTS' }}(SELECT * FROM (${populate}) AS ${{ identifier: tempName }})`;
        }
        if (dataType && _isTypeof(dataType, ['array', 'string[]', 'vector', 'relation'])) {
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
    case '$some':
      {
        if (!(expr.value instanceof QuerySelector)) break;
        const result = encodeArrayQuantifier(
          compiler, parent, field, element, dataType, relation,
          expr.value, expr.type === '$every' ? 'every' : 'some'
        );
        if (result) return result;
      }
      break;
    default: break;
  }
  throw Error('Invalid expression');
};
