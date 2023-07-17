//
//  codec.ts
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
import { Decimal } from 'decimal.js';
import {
  serialize as _serialize,
  deserialize as _deserialize,
  EJSON,
  Double,
  Long,
  Int32,
  Decimal128,
  UUID
} from 'bson';
import { IOObject } from '../types/object';

export { UUID, Decimal };
export type IONumber = number | Decimal | BigInt;
export type IOPrimitive = UUID | Date | string | IONumber | boolean | null;
export type IODictionary<Extends = never> = { [x: string]: IOSerializable<Extends> };
export type IOSerializable<Extends = never> = IODictionary<Extends> | IOSerializable<Extends>[] | IOPrimitive | Extends;

const encodeEJSON = (x: IOSerializable<IOObject>, stack: any[]): EJSON.SerializableTypes => {
  if (_.isNumber(x) || _.isNil(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof UUID) return x;
  if (x instanceof BigInt) return Number(x);
  if (x instanceof Decimal) return Decimal128.fromString(x.toString());

  const found = _.indexOf(stack, x);
  if (found !== -1) return { $ref: found };

  if (_.isArray(x)) return x.map(v => encodeEJSON(v, [...stack, x]));
  if (x instanceof IOObject) return {
    $object: {
      className: x.className,
      attributes: _.mapValues(x.attributes, v => encodeEJSON(v, [...stack, x])),
    }
  };

  return _.transform(x, (r, v, k) => {
    r[k.startsWith('$') ? `$${k}` : k] = encodeEJSON(v, [...stack, x]);
  }, {} as IODictionary<IOObject>);
}

const decodeEJSON = (x: EJSON.SerializableTypes, stack: any[]): IOSerializable<IOObject> => {
  if (_.isNumber(x) || _.isNil(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof UUID) return x;
  if (x instanceof Double || x instanceof Int32) return x.valueOf();
  if (x instanceof Decimal128 || Long.isLong(x)) return new Decimal(x.toString());

  if (_.isArray(x)) {
    return _.transform(x, (r, v) => {
      r.push(decodeEJSON(v, [...stack, r]));
    }, [] as IOSerializable<IOObject>[]);
  }

  if (x.$ref) return stack[x.$ref];

  if (x.$object) {
    const { className, attributes } = x.$object;
    return new IOObject(className, (self) => _.mapValues(attributes, v => decodeEJSON(v, [...stack, self])));
  }

  return _.transform(x, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = decodeEJSON(v, [...stack, r]);
  }, {} as IODictionary<IOObject>);
}

export const serialize = (
  x: IOSerializable<IOObject>,
  space?: string | number,
) => EJSON.stringify(encodeEJSON(x, []), undefined, space, { relaxed: false });
export const deserialize = (buffer: string) => decodeEJSON(EJSON.parse(buffer, { relaxed: false }), []);
