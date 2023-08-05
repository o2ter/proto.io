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
import { TObject, TValue, UpdateOp, _TValue, isPrimitiveValue } from '../../../internals';
import { TSchema } from '../../../server/schema';

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
    return value ? 'true' : 'false;';
  },
  nullSafeEqual(lhs: any, rhs: any) {
    return sql`${lhs} IS NOT DISTINCT FROM ${rhs}`;
  },
  nullSafeNotEqual(lhs: any, rhs: any) {
    return sql`${lhs} IS DISTINCT FROM ${rhs}`;
  },
  encodeType(value: TValue, type?: TSchema.DataType): _TValue {
    if (value instanceof TObject) return `${value.className}$${value.objectId}`;
    if (isPrimitiveValue(value)) return value;
    if (_.isArray(value)) return _.map(value, x => this.encodeType(x));
    return _.mapValues(value, x => this.encodeType(x));
  },
  updateOperation(path: string, type: TSchema.DataType, operation: [UpdateOp, TValue]) {
    const [column, ...subpath] = _.toPath(path);
    const [op, value] = operation;
    if (_.isEmpty(subpath)) {
      const _value = this.encodeType(value, type);
      switch (op) {
        case UpdateOp.set: return sql`${{ value: _value }}`;
        case UpdateOp.increment: return sql`${{ identifier: column }} + ${{ value: _value }}`;
        case UpdateOp.decrement: return sql`${{ identifier: column }} - ${{ value: _value }}`;
        case UpdateOp.multiply: return sql`${{ identifier: column }} * ${{ value: _value }}`;
        case UpdateOp.divide: return sql`${{ identifier: column }} / ${{ value: _value }}`;
        case UpdateOp.max: return sql`GREATEST(${{ identifier: column }}, ${{ value: _value }})`;
        case UpdateOp.min: return sql`LEAST(${{ identifier: column }}, ${{ value: _value }})`;
        case UpdateOp.addToSet:  throw Error('Invalid update operation');
        case UpdateOp.push:  throw Error('Invalid update operation');
        case UpdateOp.removeAll:  throw Error('Invalid update operation');
        case UpdateOp.popFirst:  throw Error('Invalid update operation');
        case UpdateOp.popLast:  throw Error('Invalid update operation');
        default: throw Error('Invalid update operation');
      }
    } else {
      throw Error('Invalid update operation');
    }
  },
};
