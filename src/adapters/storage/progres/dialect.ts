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
import { sql } from '../../../server/sql';
import { Decimal, TObject, TValue, UpdateOp, _TValue, isPrimitiveValue } from '../../../internals';
import { TSchema } from '../../../server/schema';

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

export const PostgresDialect = {
  get rowId() {
    return 'CTID';
  },
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
  encodeValue(value: TValue) {
    return _encodeValue(value);
  },
  encodeType(type: TSchema.DataType, value: TValue) {
    switch (_.isString(type) ? type : type.type) {
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
        if (_.isArray(value)) return sql`${{ value: _encodeValue(value) }}`;
        break;
      case 'pointer':
        if (value instanceof TObject && value.objectId) return sql`${{ value: `${value.className}$${value.objectId}` }}`;
        break;
      case 'relation':
        if (_.isArray(value) && _.every(value, x => x instanceof TObject && x.objectId)) {
          return sql`ARRAY[${{ value: _.uniq(_.map(value, (x: TObject) => `${x.className}$${x.objectId}`)) }}]`;
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
};
