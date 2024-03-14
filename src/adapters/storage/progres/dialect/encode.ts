//
//  encode.ts
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
import { SQL, sql } from '../../../../server/storage/sql';
import { TSchema, _typeof } from '../../../../internals/schema';
import { stringArrayAttrs } from './basic';
import Decimal from 'decimal.js';
import { TValue, _TValue, isPrimitiveValue } from '../../../../internals/query/value';
import { TObject } from '../../../../internals/object';

export const _decodeValue = (value: _TValue): _TValue => {
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _decodeValue(x));
  if (_.isString(value.$date)) return new Date(value.$date);
  if (_.isString(value.$decimal)) return new Decimal(value.$decimal);
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = _decodeValue(v);
  }, {} as any);
};

export const _encodeValue = (value: TValue): any => {
  if (value instanceof TObject) throw Error('Invalid data type');
  if (_.isDate(value)) return { $date: value.toISOString() };
  if (value instanceof Decimal) return { $decimal: value.toString() };
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _encodeValue(x));
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? `$${k}` : k] = _encodeValue(v);
  }, {} as any);
};

export const _encodeJsonValue = (value: any): SQL => {
  if (_.isArray(value)) return sql`jsonb_build_array(${_.map(value, x => _encodeJsonValue(x))})`;
  if (_.isPlainObject(value)) return sql`jsonb_build_object(${_.map(value, (v, k) => sql`${{ value: k }}, ${_encodeJsonValue(v)}`)})`;
  return sql`to_jsonb(${{ value }})`;
};

export const _encodePopulateInclude = (
  className: string,
  colname: string,
  dataType: TSchema.DataType,
): SQL => {
  switch (_typeof(dataType)) {
    case 'decimal':
      return sql`jsonb_build_object(
            '$decimal', CAST(${{ identifier: className }}.${{ identifier: colname }} AS TEXT)
          ) AS ${{ identifier: colname }}`;
    case 'date':
      return sql`jsonb_build_object(
            '$date', to_char(${{ identifier: className }}.${{ identifier: colname }} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ) AS ${{ identifier: colname }}`;
    default:
      return sql`${{ identifier: className }}.${{ identifier: colname }}`;
  }
};

export const encodeType = (colname: string, dataType: TSchema.DataType, value: TValue) => {
  if (_.isNil(value)) return sql`NULL`;
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
      if (!_.isArray(value)) break;
      if (_.includes(stringArrayAttrs, colname)) {
        if (!_.every(value, x => _.isString(x))) break;
        return sql`ARRAY[${_.map(value, x => sql`${{ value: x }}`)}]::TEXT[]`;
      }
      return sql`ARRAY[${_.map(value, x => _encodeJsonValue(_encodeValue(x)))}]::JSONB[]`;
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
};

export const decodeType = (type: TSchema.Primitive, value: any): TValue => {
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
};

