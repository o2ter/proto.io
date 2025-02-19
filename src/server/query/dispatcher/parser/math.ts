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

const isNum = (x: any): x is number | Decimal => _.isNumber(x) || x instanceof Decimal;

export const MathUtils = {
  sum: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal && rhs instanceof Decimal) return lhs.plus(rhs);
    if (lhs instanceof Decimal) return lhs.plus(rhs);
    if (rhs instanceof Decimal) return rhs.plus(lhs);
    return lhs + rhs;
  },
  subtract: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal && rhs instanceof Decimal) return lhs.minus(rhs);
    if (lhs instanceof Decimal) return lhs.minus(rhs);
    if (rhs instanceof Decimal) return rhs.minus(lhs);
    return lhs - rhs;
  },
  multiply: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal && rhs instanceof Decimal) return lhs.times(rhs);
    if (lhs instanceof Decimal) return lhs.times(rhs);
    if (rhs instanceof Decimal) return rhs.times(lhs);
    return lhs * rhs;
  },
  divide: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal && rhs instanceof Decimal) return lhs.div(rhs);
    if (lhs instanceof Decimal) return lhs.div(rhs);
    if (rhs instanceof Decimal) return rhs.div(lhs);
    return lhs / rhs;
  },
  mod: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal && rhs instanceof Decimal) return lhs.mod(rhs);
    if (lhs instanceof Decimal) return lhs.mod(rhs);
    if (rhs instanceof Decimal) return rhs.mod(lhs);
    return lhs % rhs;
  },
  abs: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.abs();
    return Math.abs(lhs);
  },
  ceil: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.ceil();
    return Math.ceil(lhs);
  },
  floor: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.floor();
    return Math.floor(lhs);
  },
  round: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.round();
    return Math.round(lhs);
  },
  exp: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.exp();
    return Math.exp(lhs);
  },
  sqrt: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.sqrt();
    return Math.sqrt(lhs);
  },
  pow: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.pow(lhs, rhs);
    return Math.pow(lhs, rhs);
  },
  log: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.log(lhs, rhs);
    return Math.log(lhs) / Math.log(rhs);
  },
  log10: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.log();
    return Math.log10(lhs);
  },
  log2: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.log(2);
    return Math.log2(lhs);
  },
  ln: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.ln();
    return Math.log(lhs);
  },
  trunc: (lhs: any, p: any) => {
    if (!isNum(lhs) || !isNum(p)) throw Error('Invalid operation');
    const precision = p instanceof Decimal ? p.toNumber() : p;
    if (lhs instanceof Decimal) return lhs.toDP(precision, Decimal.ROUND_DOWN);
    const factor = Math.pow(10, precision);
    return Math.trunc(lhs * factor) / factor;
  },
  sin: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.sin();
    return Math.sin(lhs);
  },
  cos: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.cos();
    return Math.cos(lhs);
  },
  tan: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.tan();
    return Math.tan(lhs);
  },
  asin: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.asin();
    return Math.asin(lhs);
  },
  acos: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.acos();
    return Math.acos(lhs);
  },
  atan: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.atan();
    return Math.atan(lhs);
  },
  sinh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.sinh();
    return Math.sinh(lhs);
  },
  cosh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.cosh();
    return Math.cosh(lhs);
  },
  tanh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.tanh();
    return Math.tanh(lhs);
  },
  asinh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.asinh();
    return Math.asinh(lhs);
  },
  acosh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.acosh();
    return Math.acosh(lhs);
  },
  atanh: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.atanh();
    return Math.atanh(lhs);
  },
  atan2: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.atan2(lhs, rhs);
    return Math.atan2(lhs, rhs);
  },
};
