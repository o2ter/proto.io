//
//  expressions.ts
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
import {
  TConditionalKeys,
  TComparisonKeys,
} from '../../../../internals';
import { TExpression } from '../../../../internals';

export class QueryExpression {

  static decode(expr: _.Many<TExpression>): QueryExpression {
    const exprs: QueryExpression[] = [];
    for (const selector of _.castArray(expr)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (_.includes(TConditionalKeys, key) && _.isArray(query)) {
          exprs.push(new CoditionalExpression(key as any, _.map(query, x => QueryExpression.decode(x as any))));
        } else {
          throw Error('Invalid expression');
        }
      }
    }
    if (_.isEmpty(exprs)) return new QueryExpression;
    return (exprs.length === 1 ? exprs[0] : new CoditionalExpression('$and', exprs)).simplify();
  }

  simplify(): QueryExpression {
    return this;
  }

  validate(callback: (key: string) => boolean) {
    return true;
  }
}

export class CoditionalExpression extends QueryExpression {

  type: typeof TConditionalKeys[number];
  exprs: QueryExpression[];

  constructor(type: typeof TConditionalKeys[number], exprs: QueryExpression[]) {
    super();
    this.type = type;
    this.exprs = exprs;
  }

  simplify() {
    if (_.isEmpty(this.exprs)) return new QueryExpression;
    if (this.exprs.length === 1 && this.type !== '$nor') return this.exprs[0];
    switch (this.type) {
      case '$and':
        return new CoditionalExpression(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalExpression && x.type === '$and' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QueryExpression;
      case '$nor':
      case '$or':
        return new CoditionalExpression(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalExpression && x.type === '$or' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QueryExpression;
    }
  }

  validate(callback: (key: string) => boolean) {
    return _.every(this.exprs, x => x.validate(callback));
  }
}
