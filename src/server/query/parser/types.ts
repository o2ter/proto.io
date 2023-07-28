//
//  types.ts
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
import { TCoditionalQuerySelector, TQuerySelector, TCoditionalKeys, TValue } from '../../../internals';

export class QuerySelector {

  simplify(): QuerySelector {
    return this;
  }
}

export class CoditionalSelector extends QuerySelector {

  type: keyof typeof TCoditionalKeys;
  exprs: QuerySelector[];

  constructor(type: keyof typeof TCoditionalKeys, exprs: QuerySelector[]) {
    super();
    this.type = type;
    this.exprs = exprs;
  }
}

export class FieldSelector extends QuerySelector {

  type: keyof TQuerySelector;
  field: string;
  expr: QuerySelector | RegExp | TValue;

  constructor(type: keyof TQuerySelector, field: string, expr: QuerySelector | RegExp | TValue) {
    super();
    this.type = type;
    this.field = field;
    this.expr = expr;
  }

  simplify(): QuerySelector {
    return new FieldSelector(
      this.type,
      this.field,
      this.expr instanceof QuerySelector ? this.expr.simplify() : this.expr,
    );
  }
}
