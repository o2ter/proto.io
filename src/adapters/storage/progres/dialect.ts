//
//  dialect.ts
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
import { escapeIdentifier, escapeLiteral } from 'pg/lib/utils';
import { SQL, SqlDialect, sql } from '../../../server/sql';
import { Decimal, TObject, TValue, UpdateOp, _TValue, isPrimitiveValue } from '../../../internals';
import { TSchema, _typeof, defaultObjectKeyTypes, isPrimitive } from '../../../server/schema';
import { CompileContext, Populate, QueryCompiler } from '../../../server/sql/compiler';
import { FieldExpression, QuerySelector } from '../../../server/query/validator/parser';

const _decodeValue = (value: _TValue): _TValue => {
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _decodeValue(x));
  if (_.isString(value.$date)) return new Date(value.$date);
  if (_.isString(value.$decimal)) return new Decimal(value.$decimal);
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = _decodeValue(v);
  }, {} as any);
}

const _encodeValue = (value: TValue): any => {
  if (value instanceof TObject) throw Error('Invalid data type');
  if (_.isDate(value)) return { $date: value.toISOString() };
  if (value instanceof Decimal) return { $decimal: value.toString() };
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _encodeValue(x));
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? `$${k}` : k] = _encodeValue(v);
  }, {} as any);
}

const _encodeJsonValue = (value: any): SQL => {
  if (_.isArray(value)) return sql`jsonb_build_array(${_.map(value, x => _encodeJsonValue(x))})`;
  if (_.isPlainObject(value)) return sql`${{ value }}`;
  return sql`to_jsonb(${{ value }})`;
}

const _encodePopulateIncludes = (
  className: string,
  includes: Record<string, TSchema.DataType>,
): SQL[] => {
  const _includes = _.pickBy(includes, v => isPrimitive(v));
  return _.map(_includes, (dataType, colname) => {
    if (isPrimitive(dataType)) {
      switch (_typeof(dataType)) {
        case 'decimal': return sql`jsonb_build_object(
            '$decimal', CAST(${{ identifier: className }}.${{ identifier: colname }} AS TEXT)
          ) AS ${{ identifier: colname }}`;
        case 'date': return sql`jsonb_build_object(
            '$date', to_char(${{ identifier: className }}.${{ identifier: colname }} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ) AS ${{ identifier: colname }}`;
        default: break;
      }
    }
    return sql`${{ identifier: className }}.${{ identifier: colname }}`;
  });
};

export const PostgresDialect: SqlDialect = {
  quote(str: string) {
    return escapeLiteral(str);
  },
  identifier(name: string) {
    return escapeIdentifier(name);
  },
  placeholder(idx: number) {
    return `$${idx}`;
  },
  boolean(value: boolean) {
    return value ? 'true' : 'false';
  },
  nullSafeEqual() {
    return sql`IS NOT DISTINCT FROM`;
  },
  nullSafeNotEqual() {
    return sql`IS DISTINCT FROM`;
  },
  encodeType(dataType: TSchema.DataType, value: TValue) {
    switch (_.isString(dataType) ? dataType : dataType.type) {
      case 'boolean':
        if (_.isBoolean(value)) return sql`${{ value }}`;
        break;
      case 'number':
        if (_.isNumber(value) && _.isFinite(value)) return sql`${{ value }}`;
        if (value instanceof Decimal) return sql`${{ value: value.toNumber() }}`;
        break;
      case 'decimal':
        if (_.isNumber(value) && _.isFinite(value)) return sql`CAST(${{ quote: (new Decimal(value)).toString() }} AS DECIMAL)`;
        if (value instanceof Decimal) return sql`CAST(${{ quote: value.toString() }} AS DECIMAL)`;
        break;
      case 'string':
        if (_.isString(value)) return sql`${{ value }}`;
        break;
      case 'date':
        if (_.isDate(value)) return sql`${{ value }}`;
        break;
      case 'object':
        if (_.isPlainObject(value)) return sql`${{ value: _encodeValue(value) }}`;
        break;
      case 'array':
        if (_.isArray(value)) return sql`ARRAY[${_.map(value, x => _encodeJsonValue(_encodeValue(x)))}]::JSONB[]`;
        break;
      case 'pointer':
        if (value instanceof TObject && value.objectId) return sql`${{ value: `${value.className}$${value.objectId}` }}`;
        break;
      case 'relation':
        if (_.isArray(value) && _.every(value, x => x instanceof TObject && x.objectId)) {
          return sql`${{ value: _.uniq(_.map(value, (x: TObject) => `${x.className}$${x.objectId}`)) }}`;
        }
        break;
      default: break;
    }

    throw Error('Invalid data type');
  },
  decodeType(type: TSchema.Primitive, value: any): TValue {
    switch (type) {
      case 'boolean':
        if (_.isBoolean(value)) return value;
        if (value === 'true') return true;
        if (value === 'false') return false;
        break;
      case 'number':
        if (_.isNumber(value)) return value;
        if (_.isString(value)) {
          const float = parseFloat(value);
          return _.isNaN(float) ? null : float;
        }
        break;
      case 'decimal':
        if (_.isString(value) || _.isNumber(value)) return new Decimal(value);
        if (value instanceof Decimal) return value;
        if (_.isPlainObject(value) && _.isString(value.$decimal)) return new Decimal(value.$decimal);
        break;
      case 'string':
        if (_.isString(value)) return value;
        break;
      case 'date':
        if (_.isDate(value)) return value;
        if (_.isString(value)) {
          const date = new Date(value);
          if (isFinite(date.valueOf())) return date;
        }
        if (_.isPlainObject(value) && _.isString(value.$date)) return new Date(value.$date);
        break;
      case 'object':
        if (_.isPlainObject(value)) return _decodeValue(value);
        break;
      case 'array':
        if (_.isArray(value)) return _decodeValue(value);
        break;
      default: break;
    }
    return null;
  },
  updateOperation(path: string, type: TSchema.DataType, operation: [UpdateOp, TValue]) {
    const [column, ...subpath] = _.toPath(path);
    const [op, value] = operation;
    if (_.isEmpty(subpath)) {
      switch (op) {
        case UpdateOp.set: return sql`${this.encodeType(type, value)}`;
        case UpdateOp.increment: return sql`${{ identifier: column }} + ${this.encodeType(type, value)}`;
        case UpdateOp.decrement: return sql`${{ identifier: column }} - ${this.encodeType(type, value)}`;
        case UpdateOp.multiply: return sql`${{ identifier: column }} * ${this.encodeType(type, value)}`;
        case UpdateOp.divide: return sql`${{ identifier: column }} / ${this.encodeType(type, value)}`;
        case UpdateOp.max: return sql`GREATEST(${{ identifier: column }}, ${this.encodeType(type, value)})`;
        case UpdateOp.min: return sql`LEAST(${{ identifier: column }}, ${this.encodeType(type, value)})`;
        case UpdateOp.addToSet: break;
        case UpdateOp.push: break;
        case UpdateOp.removeAll: break;
        case UpdateOp.popFirst: break;
        case UpdateOp.popLast: break;
        default: break;
      }
    } else {
    }
    throw Error('Invalid update operation');
  },
  selectPopulate(
    compiler: QueryCompiler,
    parent: Pick<Populate, 'className' | 'name' | 'colname' | 'includes'>,
    populate: Populate,
    field: string,
  ): { column: SQL, join?: SQL } {
    const { name, className, type, foreignField } = populate;
    const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
    const _foreign = (field: string) => sql`${{ identifier: name }}.${{ identifier: field }}`;

    if (type === 'pointer') {
      return {
        column: sql`to_jsonb(${{ identifier: populate.name }}) AS ${{ identifier: field }}`,
        join: sql`
          LEFT JOIN ${{ identifier: populate.name }}
          ON ${sql`(${{ quote: className + '$' }} || ${_foreign('_id')})`} = ${_local(parent.colname)}
        `,
      };
    }

    let cond: SQL;
    if (_.isNil(foreignField)) {
      cond = sql`${sql`(${{ quote: className + '$' }} || ${_foreign('_id')})`} = ANY(${_local(parent.colname)})`;
    } else if (foreignField.type === 'pointer') {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ${_foreign(foreignField.colname)}`;
    } else {
      cond = sql`${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${_foreign(foreignField.colname)})`;
    }
    return {
      column: sql`
        ARRAY(
          SELECT to_jsonb(${{ identifier: populate.name }}) FROM (
            SELECT ${_.map(_.keys(_.pickBy(populate.includes, v => isPrimitive(v))), (colname) => sql`${{ identifier: populate.name }}.${{ identifier: colname }}`)}
            FROM ${{ identifier: populate.name }} WHERE ${cond}
            ${!_.isEmpty(populate.sort) ? sql`ORDER BY ${compiler._encodeSort(populate.name, populate.sort)}` : sql``}
            ${populate.limit ? sql`LIMIT ${{ literal: `${populate.limit}` }}` : sql``}
            ${populate.skip ? sql`OFFSET ${{ literal: `${populate.skip}` }}` : sql``}
          ) ${{ identifier: populate.name }}
        ) AS ${{ identifier: field }}
      `,
    };
  },
  encodePopulate(
    compiler: QueryCompiler,
    context: CompileContext,
    parent: Populate,
    remix?: { className: string; name: string; }
  ): Record<string, SQL> {
    const _filter = compiler._encodeFilter(context, parent, parent.filter);
    const _populates = _.map(parent.populates, (populate, field) => this.selectPopulate(compiler, parent, populate, field));
    const _joins = _.compact(_.map(_populates, ({ join }) => join));
    return _.reduce(parent.populates, (acc, populate) => ({
      ...this.encodePopulate(compiler, context, populate, remix),
      ...acc,
    }), {
      [parent.name]: sql`
        SELECT
        ${{
          literal: [
            ..._encodePopulateIncludes(parent.name, parent.includes),
            ...parent.foreignField ? [sql`${{ identifier: parent.name }}.${{ identifier: parent.foreignField.colname }}`] : [],
            ..._.map(_populates, ({ column }) => column),
          ], separator: ',\n'
        }}
        FROM ${remix?.className === parent.className ? sql`
        (SELECT * FROM ${{ identifier: remix.name }} UNION SELECT * FROM ${{ identifier: parent.className }})
        ` : { identifier: parent.className }} AS ${{ identifier: parent.name }}
        ${!_.isEmpty(_joins) ? { literal: _joins, separator: '\n' } : sql``}
        ${_filter ? sql`WHERE ${_filter}` : sql``}
      `,
    });
  },
  encodeFieldExpression(
    compiler: QueryCompiler,
    context: CompileContext,
    parent: { className?: string; name: string; },
    field: string,
    expr: FieldExpression,
  ): SQL {
    const [colname, ...subpath] = _.toPath(field);
    const dataType = parent.className && _.isEmpty(subpath) ? compiler.schema[parent.className].fields[colname] ?? defaultObjectKeyTypes[colname] : null;
    let element = sql`${{ identifier: parent.name }}.${{ identifier: parent.name.startsWith('_expr_$') ? '$' : colname }}`;
    if (!parent.className) {
      const _type = parent.className ? compiler.schema[parent.className].fields[colname] ?? defaultObjectKeyTypes[colname] : null;
      if (_type === 'array' || (!_.isString(_type) && (_type?.type === 'array' || _type?.type === 'relation'))) {
        element = sql`jsonb_extract_path(to_jsonb(${element}), ${_.map([colname, ...subpath], x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
      } else if (colname !== '$') {
        element = sql`jsonb_extract_path(${element}, ${_.map([colname, ...subpath], x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
      } else if (!_.isEmpty(subpath)) {
        element = sql`jsonb_extract_path(${element}, ${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
      }
    } else if (!_.isEmpty(subpath)) {
      const _type = parent.className ? compiler.schema[parent.className].fields[colname] ?? defaultObjectKeyTypes[colname] : null;
      if (_type === 'array' || (!_.isString(_type) && (_type?.type === 'array' || _type?.type === 'relation'))) {
        element = sql`jsonb_extract_path(to_jsonb(${element}), ${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
      } else {
        element = sql`jsonb_extract_path(${element}, ${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)})`;
      }
    }
    const encodeValue = (value: TValue) => dataType ? this.encodeType(dataType, value) : _encodeJsonValue(_encodeValue(value));
    switch (expr.type) {
      case '$eq':
        {
          if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
          if (_.isNil(expr.value)) return sql`${element} IS NULL`;
          return sql`${element} ${this.nullSafeEqual()} ${encodeValue(expr.value)}`;
        }
      case '$ne':
        {
          if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
          if (_.isNil(expr.value)) return sql`${element} IS NOT NULL`;
          return sql`${element} ${this.nullSafeNotEqual()} ${encodeValue(expr.value)}`;
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
          if (_.isRegExp(expr.value) || expr.value instanceof QuerySelector || expr.value instanceof FieldExpression) break;
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
          } else if (!dataType) {
            if (expr.value instanceof Decimal || _.isNumber(expr.value)) {
              return sql`(
                jsonb_typeof(${element}) ${this.nullSafeEqual()} 'number'
                AND ${element}::NUMERIC ${{ literal: operatorMap[expr.type] }} ${{ value: expr.value instanceof Decimal ? expr.value.toNumber() : expr.value }}
              ) OR (
                jsonb_typeof(${element} -> '$decimal') ${this.nullSafeEqual()} 'string'
                AND (${element} ->> '$decimal')::DECIMAL ${{ literal: operatorMap[expr.type] }} ${{ value: expr.value instanceof Decimal ? expr.value.toString() : expr.value }}::DECIMAL
              )`;
            } else if (_.isDate(expr.value)) {
              return sql`(
                jsonb_typeof(${element} -> '$date') ${this.nullSafeEqual()} 'string'
                AND ${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}
              )`;
            } else {
              return sql`${element} ${{ literal: operatorMap[expr.type] }} ${encodeValue(expr.value)}`
            }
          }
        }
      case '$in':
        {
          if (!_.isArray(expr.value)) break;
          return sql`${element} IN (${_.map(expr.value, x => encodeValue(x))})`;
        }
      case '$nin':
        {
          if (!_.isArray(expr.value)) break;
          return sql`${element} NOT IN (${_.map(expr.value, x => encodeValue(x))})`;
        }
      case '$subset':
        {
          if (!_.isArray(expr.value)) break;
          if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
            return sql`${element} <@ ${{ value: _encodeValue(expr.value) }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND ${element} <@ ${_encodeJsonValue(_encodeValue(expr.value))}`;
          }
        }
      case '$superset':
        {
          if (!_.isArray(expr.value)) break;
          if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
            return sql`${element} @> ${{ value: _encodeValue(expr.value) }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND ${element} @> ${_encodeJsonValue(_encodeValue(expr.value))}`;
          }
        }
      case '$disjoint':
        {
          if (!_.isArray(expr.value)) break;
          if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
            return sql`NOT ${element} && ${{ value: _encodeValue(expr.value) }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND NOT ${element} && ${_encodeJsonValue(_encodeValue(expr.value))}`;
          }
        }
      case '$intersect':
        {
          if (!_.isArray(expr.value)) break;
          if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
            return sql`${element} && ${{ value: _encodeValue(expr.value) }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND ${element} && ${_encodeJsonValue(_encodeValue(expr.value))}`;
          }
        }
      case '$not':
        {
          if (!(expr.value instanceof FieldExpression)) break;
          return sql`NOT (${this.encodeFieldExpression(compiler, context, parent, field, expr.value)})`;
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
              return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
            } else if (_.isRegExp(expr.value)) {
              if (expr.value.ignoreCase) return sql`${element} ~* ${{ value: expr.value.source }}`;
              return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'string' AND (${element} #>> '{}') ~ ${{ value: expr.value.source }}`;
            }
          }
        }
      case '$starts':
        {
          if (!_.isString(expr.value)) break;
          if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
            return sql`${element} LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `${expr.value.replace(/([\\_%])/g, '\\$1')}%` }}`;
          }
        }
      case '$ends':
        {
          if (!_.isString(expr.value)) break;
          if (dataType === 'string' || (!_.isString(dataType) && dataType?.type === 'string')) {
            return sql`${element} LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'string' AND (${element} #>> '{}') LIKE ${{ value: `%${expr.value.replace(/([\\_%])/g, '\\$1')}` }}`;
          }
        }
      case '$size':
        {
          if (!_.isNumber(expr.value) || !_.isInteger(expr.value)) break;
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
          const filter = compiler._encodeFilter(context, { name: tempName }, expr.value);
          if (!filter) break;

          if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'relation'))) {
            return sql`NOT EXISTS(
              SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
              WHERE NOT (${filter})
            )`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND NOT EXISTS(
              SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
              WHERE NOT (${filter})
            )`;
          }
        }
      case '$some':
        {
          if (!(expr.value instanceof QuerySelector)) break;

          const tempName = `_expr_$${compiler.nextIdx()}`;
          const filter = compiler._encodeFilter(context, { name: tempName }, expr.value);
          if (!filter) break;

          if (dataType === 'array' || (!_.isString(dataType) && (dataType?.type === 'array' || dataType?.type === 'relation'))) {
            return sql`EXISTS(
              SELECT * FROM (SELECT UNNEST AS "$" FROM UNNEST(${element})) AS ${{ identifier: tempName }}
              WHERE ${filter}
            )`;
          } else if (!dataType) {
            return sql`jsonb_typeof(${element}) ${this.nullSafeEqual()} 'array' AND EXISTS(
              SELECT * FROM (SELECT value AS "$" FROM jsonb_array_elements(${element})) AS ${{ identifier: tempName }}
              WHERE ${filter}
            )`;
          }
        }
      default: break;
    }
    throw Error('Invalid expression');
  },
  encodeSortKey(className: string, key: string): SQL {
    const [colname, ...subpath] = _.toPath(key);
    if (_.isEmpty(subpath)) return sql`${{ identifier: className }}.${{ identifier: colname }}`;
    return sql`jsonb_extract_path(
      ${{ identifier: className }}.${{ identifier: colname }},
      ${_.map(subpath, x => sql`${{ quote: x }}`)}
    )`;
  },
};
