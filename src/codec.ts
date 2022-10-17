//
//  codec.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2022 O2ter Limited. All rights reserved.
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
import { EJSON, Double, Long, Int32, Decimal128, ObjectId, UUID } from 'bson';

export { ObjectId, UUID };
export type IONumber = number | Decimal | BigInt;
export type Primitive = ObjectId | UUID | string | IONumber | boolean | null;
export type SerializableTypes = { [x: string]: SerializableTypes } | SerializableTypes[] | Primitive;

type BsonNumber = number | Double | Long | Decimal128;

const isBsonNumber = (x?: any): x is BsonNumber => _.isNumber(x) || Decimal.isDecimal(x) || x instanceof BigInt;
const isNumber = (x?: any): x is IONumber => _.isNumber(x) || Decimal.isDecimal(x) || x instanceof BigInt;

const encodeNumber = (x: IONumber) => {
  if (x instanceof BigInt) return Number(x);
  if (x instanceof Decimal) return Decimal128.fromString(x.toString());
  return x;
}

const decodeNumber = (x: BsonNumber) => {
  if (x instanceof Double || x instanceof Int32) return x.valueOf();
  if (x instanceof Decimal128 || Long.isLong(x)) return new Decimal(x.toString());
  return x;
}

const encodeEJSON = (x: SerializableTypes): EJSON.SerializableTypes => {
  if (_.isNil(x) || _.isBoolean(x) || _.isString(x)) return x;
  if (x instanceof ObjectId || x instanceof UUID) return x;
  if (isNumber(x)) return encodeNumber(x);
  if (_.isArray(x)) return x.map(encodeEJSON);
  return _.mapValues(x, encodeEJSON);
}

const decodeEJSON = (x: EJSON.SerializableTypes): SerializableTypes => {
  if (_.isNil(x) || _.isBoolean(x) || _.isString(x)) return x;
  if (x instanceof ObjectId || x instanceof UUID) return x;
  if (isBsonNumber(x)) return decodeNumber(x);
  if (_.isArray(x)) return x.map(decodeEJSON);
  return _.mapValues(x, decodeEJSON);
}

export const serialize = (x: SerializableTypes, space?: string | number) => EJSON.stringify(encodeEJSON(x), undefined, space, { relaxed: false });
export const deserialize = (buffer: string) => decodeEJSON(EJSON.parse(buffer, { relaxed: false }));
