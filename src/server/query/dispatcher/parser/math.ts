//
//  utils.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.add(lhs, rhs);
    return lhs + rhs;
  },
  subtract: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.sub(lhs, rhs);
    return lhs - rhs;
  },
  multiply: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.mul(lhs, rhs);
    return lhs * rhs;
  },
  divide: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.div(lhs, rhs);
    return lhs / rhs;
  },
  abs: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.abs();
    return Math.abs(lhs);
  },
  neg: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.neg();
    return -lhs;
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
  cbrt: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return lhs.cbrt();
    return Math.cbrt(lhs);
  },
  mod: (lhs: any, rhs: any) => {
    if (!isNum(lhs) || !isNum(rhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal || rhs instanceof Decimal) return Decimal.mod(lhs, rhs);
    return lhs % rhs;
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
  degrees: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return Decimal.div(Decimal.mul(lhs, 180), Math.PI);
    return (lhs * 180) / Math.PI;
  },
  radians: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return Decimal.div(Decimal.mul(lhs, Math.PI), 180);
    return (lhs * Math.PI) / 180;
  },
  sign: (lhs: any) => {
    if (!isNum(lhs)) throw Error('Invalid operation');
    if (lhs instanceof Decimal) return Decimal.sign(lhs);
    return Math.sign(lhs);
  },
};
