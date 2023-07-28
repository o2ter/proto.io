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
import { TObject } from './object';
import { TObjectTypes } from './object/types';
import { isObjKey } from './utils';
import { TValue } from './query/value';

export { UUID, Decimal };
type TNumber = number | Decimal | BigInt;
type TPrimitive = UUID | Date | string | TNumber | boolean | null;
type TDictionary = { [x: string]: TSerializable };
export type TSerializable = TDictionary | TSerializable[] | TPrimitive | TObject;

export type SerializeOptions = {
  space?: string | number;
  objAttrs?: string[];
};

const encodeEJSON = (
  x: TSerializable,
  stack: any[],
  options: SerializeOptions,
): EJSON.SerializableTypes => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof UUID) return x;
  if (x instanceof BigInt) return Number(x);
  if (x instanceof Decimal) return Decimal128.fromString(x.toString());

  const found = _.indexOf(stack, x);
  if (found !== -1) return { $ref: found };

  if (_.isArray(x)) return x.map(v => encodeEJSON(v, [...stack, x], options));
  if (x instanceof TObject) {
    const attributes = options.objAttrs ? _.pick(x.attributes, ...options.objAttrs) : x.attributes;
    return {
      $object: {
        className: x.className,
        attributes: _.mapValues(attributes, v => encodeEJSON(v, [...stack, x], options)),
      }
    };
  }

  return _.transform(x, (r, v, k) => {
    r[k.startsWith('$') ? `$${k}` : k] = encodeEJSON(v, [...stack, x], options);
  }, {} as TDictionary);
}

const decodeEJSON = (
  x: EJSON.SerializableTypes,
  stack: any[],
): TSerializable => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return x;
  if (x instanceof UUID) return x;
  if (x instanceof Double || x instanceof Int32) return x.valueOf();
  if (x instanceof Decimal128 || Long.isLong(x)) return new Decimal(x.toString());

  if (_.isArray(x)) {
    return _.transform(x, (r, v) => {
      r.push(decodeEJSON(v, [...stack, r]));
    }, [] as TSerializable[]);
  }

  if (x.$ref) return stack[x.$ref];

  if (x.$object) {
    const { className, attributes } = x.$object;
    const _attributes = (self: TObject) => _.mapValues(attributes, v => decodeEJSON(v, [...stack, self])) as Record<string, TValue>;
    return isObjKey(className, TObjectTypes) ? new TObjectTypes[className](_attributes) : new TObject(className, _attributes);
  }

  return _.transform(x, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = decodeEJSON(v, [...stack, r]);
  }, {} as TDictionary);
}

export const serialize = (
  x: TSerializable,
  options?: SerializeOptions,
) => EJSON.stringify(encodeEJSON(x, [], options ?? {}), undefined, options?.space, { relaxed: false });

export const deserialize = (buffer: string) => decodeEJSON(EJSON.parse(buffer, { relaxed: false }), []);
