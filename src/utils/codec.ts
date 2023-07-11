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
  ObjectId,
  UUID
} from 'bson';

export { ObjectId, UUID, Decimal };
export type IONumber = number | Decimal | BigInt;
export type IOPrimitive = ObjectId | UUID | Date | string | IONumber | boolean | null;
export type IODictionary = { [x: string]: IOSerializable };
export type IOSerializable = IODictionary | IOSerializable[] | IOPrimitive;

type Encoder<T> = {
  isTypeOf: (x: any) => x is T;
  encode: (x: T) => IOSerializable;
};

const encodeEJSON = <T extends object>(
  x: IOSerializable,
  encoders: Record<string, Encoder<T>>,
): EJSON.SerializableTypes => {
  if (_.isNumber(x) || _.isNil(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof ObjectId || x instanceof UUID) return x;
  if (x instanceof BigInt) return Number(x);
  if (x instanceof Decimal) return Decimal128.fromString(x.toString());
  if (_.isArray(x)) return x.map(v => encodeEJSON(v, encoders));
  for (const [key, encoder] of _.toPairs(encoders)) {
    if (encoder.isTypeOf(x)) return { [`$${key}`]: encodeEJSON(encoder.encode(x), encoders) };
  }
  return _.transform(x, (r, v, k) => { r[k.startsWith('$') ? `$${k}` : k] = encodeEJSON(v, encoders); }, {} as IODictionary);
}

const decodeEJSON = <T extends object>(
  x: EJSON.SerializableTypes,
  decoders: Record<string, (x: IOSerializable) => T>,
): IOSerializable | T => {
  if (_.isNumber(x) || _.isNil(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof ObjectId || x instanceof UUID) return x;
  if (x instanceof Double || x instanceof Int32) return x.valueOf();
  if (x instanceof Decimal128 || Long.isLong(x)) return new Decimal(x.toString());
  if (_.isArray(x)) return x.map(v => decodeEJSON(v, decoders)) as IOSerializable;
  for (const [key, decoder] of _.toPairs(decoders)) {
    if (x[`$${key}`]) return decoder(decodeEJSON(x[`$${key}`], decoders) as any);
  }
  return _.transform(x, (r, v, k) => { r[k.startsWith('$') ? k.substring(1) : k] = decodeEJSON(v, decoders) as any; }, {} as IODictionary);
}

export const serialize = <T extends object>(
  x: IOSerializable,
  space?: string | number,
  encoders?: Record<string, Encoder<T>>,
) => EJSON.stringify(encodeEJSON(x, encoders ?? {}), undefined, space, { relaxed: false });

export const deserialize = <T extends object>(
  buffer: string,
  decoders?: Record<string, (x: IOSerializable) => T>,
) => decodeEJSON(EJSON.parse(buffer, { relaxed: false }), decoders ?? {});
