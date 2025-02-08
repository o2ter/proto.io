//
//  utils.ts
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
import Decimal from 'decimal.js';
import { TNumber } from '../../../../common';

const isNum = (x: any): x is TNumber => _.isNumber(x) || x instanceof BigInt || x instanceof Decimal;

const equalNum = (lhs: TNumber, rhs: TNumber) => {
  if (lhs instanceof Decimal && rhs instanceof Decimal) {
    return lhs.equals(rhs);
  } else if (lhs instanceof Decimal) {
    return lhs.equals(rhs instanceof BigInt ? rhs.toString() : rhs);
  } else if (rhs instanceof Decimal) {
    return rhs.equals(lhs instanceof BigInt ? lhs.toString() : lhs);
  } else {
    return lhs === rhs;
  }
}

const lessNum = (lhs: TNumber, rhs: TNumber) => {
  if (lhs instanceof Decimal && rhs instanceof Decimal) {
    return lhs.lessThan(rhs);
  } else if (lhs instanceof Decimal) {
    return lhs.lessThan(rhs instanceof BigInt ? rhs.toString() : rhs);
  } else if (rhs instanceof Decimal) {
    return rhs.greaterThan(lhs instanceof BigInt ? lhs.toString() : lhs);
  } else {
    return lhs < rhs;
  }
}

export const equal = (lhs: any, rhs: any) => {
  if (_.isNil(lhs) && _.isNil(rhs)) return true;
  if (isNum(lhs) && isNum(rhs)) return equalNum(lhs, rhs);
  return _.isEqual(lhs, rhs);
};

export const lessThan = (lhs: any, rhs: any) => {
  if (_.isString(lhs) && _.isString(rhs)) return lhs < rhs;
  if (_.isDate(lhs) && _.isDate(rhs)) return lhs < rhs;
  if (isNum(lhs) && isNum(rhs)) return lessNum(lhs, rhs);
  if (_.isArray(lhs) && _.isArray(rhs)) {
    for (const i of _.range(Math.min(lhs.length, rhs.length))) {
      if (lessThan(lhs[i], rhs[i])) return true;
      if (greaterThan(lhs[i], rhs[i])) return false;
    }
    return lhs.length < rhs.length;
  }
  return false;
};

export const greaterThan = (lhs: any, rhs: any) => {
  return lessThan(rhs, lhs);
};

export const lessThanOrEqual = (lhs: any, rhs: any) => {
  return equal(lhs, rhs) || lessThan(lhs, rhs);
};

export const greaterThanOrEqual = (lhs: any, rhs: any) => {
  return lessThanOrEqual(rhs, lhs);
};

export const isSubset = (lhs: any[], rhs: any[]) => {
  return _.some(lhs, l => _.every(rhs, r => equal(l, r)));
}

export const isSuperset = (lhs: any[], rhs: any[]) => {
  return isSubset(rhs, lhs);
}

export const isIntersect = (lhs: any[], rhs: any[]) => {
  return _.some(lhs, l => _.some(rhs, r => equal(l, r)));
}

export const innerProduct = (v1: number[], v2: number[]) => {
  if (v1.length !== v2.length) throw Error('Invalid comparison of two vectors of different lengths');
  return _.sumBy(_.zip(v1, v2), ([a, b]) => (a! - b!) ** 2);
};

export const distance = (v1: number[], v2: number[]) => {
  return Math.sqrt(innerProduct(v1, v2));
};

export const rectilinearDistance = (v1: number[], v2: number[]) => {
  if (v1.length !== v2.length) throw Error('Invalid comparison of two vectors of different lengths');
  return _.sumBy(_.zip(v1, v2), ([a, b]) => Math.abs(a! - b!));
};

export const cosine = (v1: number[], v2: number[]) => {
  if (v1.length !== v2.length) throw Error('Invalid comparison of two vectors of different lengths');
  const s1 = _.sumBy(v1, v => v ** 2);
  const s2 = _.sumBy(v2, v => v ** 2);
  if (s1 === 0 && s2 === 0) return 1;
  if (s1 === 0 || s2 === 0) return 0;
  return _.sumBy(_.zip(v1, v2), ([a, b]) => a! * b!) / Math.sqrt(s1 * s2);
};
