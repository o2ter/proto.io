//
//  value.ts
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
import { TObject } from '../object';

export type TPrimitiveValue = boolean | number | Decimal | string | Date | null;
export type TDictionaryValue = { [x: string]: TValue; };
export type TValue = TDictionaryValue | TValue[] | TPrimitiveValue | TObject;

export const isPrimitiveValue = (x: any): x is TPrimitiveValue => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return true;
  if (x instanceof Decimal) return true;
  return false;
}

export const isValue = (x: any): x is TValue => {
  if (isPrimitiveValue(x) || x instanceof TObject) return true;
  if (_.isArray(x)) return _.every(x, v => isValue(v));
  if (_.isPlainObject(x)) return _.every(x, v => isValue(v));
  return false;
}

export const cloneValue = <T extends TValue>(x: T): T => {
  if (isPrimitiveValue(x) || x instanceof TObject) return x;
  if (_.isArray(x)) return x.map(v => cloneValue(v)) as T;
  return _.mapValues(x, v => cloneValue(v)) as T;
}
