//
//  codec.ts
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
import { Decimal } from 'decimal.js';
import { TObject } from '../internals/object';
import { TObjectTypes } from '../internals/object/types';
import { isObjKey } from '../internals/utils';
import { _TContainer, TValue } from '../internals/types';
import { prototypes } from '@o2ter/utils-js';

export { Decimal };
export type TNumber = number | Decimal | BigInt;
type TPrimitive = RegExp | Date | string | TNumber | boolean | null | undefined;
export type TSerializable = _TContainer<TPrimitive | TObject>;

export type SerializeOptions = {
  space?: string | number;
  objAttrs?: string[];
};

export type DeserializeOptions = {
  objAttrs?: string[];
};

const encodeEJSON = (
  x: TSerializable,
  stack: any[],
  options: SerializeOptions,
): any => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x)) return x ?? null;
  if (_.isDate(x)) return { $date: x.valueOf() };
  if (_.isRegExp(x)) return { $regex: x.source, $options: x.flags };
  if (x instanceof BigInt) return { $integer: x.toString() };
  if (x instanceof Decimal) return { $decimal: x.toString() };

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

  const props = _.uniq(_.flatMap([x, ...prototypes(x)], x => Object.getOwnPropertyNames(x)));
  return _.transform(
    _.pick(x, props),
    (r, v, k) => {
      if (_.isFunction(v)) return;
      r[k.startsWith('$') ? `$${k}` : k] = encodeEJSON(v, [...stack, x], options);
    },
    {} as { [x: string]: TSerializable },
  );
}

const decodeEJSON = (
  x: any,
  stack: any[],
  options: DeserializeOptions,
): TSerializable => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x)) return x ?? null;
  if (_.isArray(x)) {
    return _.transform(x, (r, v) => {
      r.push(decodeEJSON(v, [...stack, r], options));
    }, [] as TSerializable[]);
  }
  if (!_.isNil(x.$date)) return new Date(x.$date);
  if (!_.isNil(x.$regex)) return new RegExp(x.$regex, x.$options || '');
  if (!_.isNil(x.$integer)) return BigInt(x.$integer);
  if (!_.isNil(x.$decimal)) return new Decimal(x.$decimal);
  if (!_.isNil(x.$ref)) return stack[x.$ref];
  if (!_.isNil(x.$object)) {
    const { className, attributes } = x.$object;
    const _attributes = (self: TObject) => _.mapValues(
      options.objAttrs ? _.pick(attributes, ...options.objAttrs) : attributes,
      v => decodeEJSON(v, [...stack, self], options),
    ) as Record<string, TValue>;
    return isObjKey(className, TObjectTypes) ? new TObjectTypes[className](_attributes) : new TObject(className, _attributes);
  }
  return _.transform(x, (r, v, k) => {
    if (_.isString(k)) r[k.startsWith('$') ? k.substring(1) : k] = decodeEJSON(v, [...stack, r], options);
  }, {} as { [x: string]: TSerializable });
}

export const serialize = (
  x: TSerializable,
  options?: SerializeOptions,
) => JSON.stringify(encodeEJSON(x, [], options ?? {}), undefined, options?.space);

export const deserialize = (
  buffer: string,
  options?: DeserializeOptions,
) => decodeEJSON(JSON.parse(buffer), [], options ?? {});
