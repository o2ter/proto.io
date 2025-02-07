//
//  expressions.ts
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
import { TExpression } from '../../../../internals/query/types/expressions';
import { TComparisonKeys, TConditionalKeys, TDistanceKeys } from '../../../../internals/query/types/keys';
import { isValue } from '../../../../internals/object';
import { TValue } from '../../../../internals/types';

export class QueryExpression {

  static decode(expr: _.Many<TExpression>, dollerSign: boolean): QueryExpression {
    const exprs: QueryExpression[] = [];
    for (const selector of _.castArray(expr)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (_.includes(TConditionalKeys, key) && _.isArray(query)) {
          exprs.push(new QueryCoditionalExpression(key as any, _.map(query, x => QueryExpression.decode(x as any, dollerSign))));
        } else if (_.includes(TComparisonKeys, key) && _.isArray(query) && query.length === 2) {
          const [left, right] = query;
          exprs.push(new QueryComparisonExpression(key as any, QueryExpression.decode(left as any, dollerSign), QueryExpression.decode(right as any, dollerSign)));
        } else if (_.includes(TDistanceKeys, key) && _.isArray(query) && query.length === 2) {
          const [left, right] = query;
          const _left = _.isArray(left) ? _.map(left, x => QueryExpression.decode(x as any, dollerSign)) : QueryExpression.decode(left as any, dollerSign);
          const _right = _.isArray(right) ? _.map(right, x => QueryExpression.decode(x as any, dollerSign)) : QueryExpression.decode(right as any, dollerSign);
          exprs.push(new QueryDistanceExpression(key as any, _.castArray(_left), _.castArray(_right)));
        } else if (key === '$not') {
          exprs.push(new QueryNotExpression(QueryExpression.decode(query as any, dollerSign)));
        } else if (key === '$array' && _.isArray(query)) {
          exprs.push(new QueryArrayExpression(_.map(query, x => QueryExpression.decode(x as any, dollerSign))));
        } else if (key === '$key' && _.isString(query)) {
          if (dollerSign && query === '$') {
            exprs.push(new QueryKeyExpression(query));
          } else if (!query.startsWith('$')) {
            exprs.push(new QueryKeyExpression(query));
          } else {
            throw Error('Invalid expression');
          }
        } else if (key === '$value' && isValue(query)) {
          exprs.push(new QueryValueExpression(query));
        } else {
          throw Error('Invalid expression');
        }
      }
    }
    if (_.isEmpty(exprs)) return new QueryExpression;
    return (exprs.length === 1 ? exprs[0] : new QueryCoditionalExpression('$and', exprs)).simplify();
  }

  simplify(): QueryExpression {
    return this;
  }

  keyPaths(): string[] {
    return [];
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return this;
  }

  eval(value: any): boolean {
    return true;
  }
}

export class QueryCoditionalExpression extends QueryExpression {

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
        return new QueryCoditionalExpression(this.type, _.flatMap(
          this.exprs, x => x instanceof QueryCoditionalExpression && x.type === '$and' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QueryExpression;
      case '$nor':
      case '$or':
        return new QueryCoditionalExpression(this.type, _.flatMap(
          this.exprs, x => x instanceof QueryCoditionalExpression && x.type === '$or' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QueryExpression;
    }
  }

  keyPaths(): string[] {
    return _.uniq(_.flatMap(this.exprs, x => x.keyPaths()));
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryCoditionalExpression(this.type, _.map(this.exprs, x => x.mapKey(callback)));
  }

  eval(value: any) {
    switch (this.type) {
      case '$and': return _.every(this.exprs, expr => expr.eval(value));
      case '$nor': return !_.some(this.exprs, expr => expr.eval(value));
      case '$or': return _.some(this.exprs, expr => expr.eval(value));
    }
  }
}

export class QueryComparisonExpression extends QueryExpression {

  type: typeof TComparisonKeys[number];
  left: QueryExpression;
  right: QueryExpression;

  constructor(type: typeof TComparisonKeys[number], left: QueryExpression, right: QueryExpression) {
    super();
    this.type = type;
    this.left = left;
    this.right = right;
  }

  simplify() {
    return new QueryComparisonExpression(this.type, this.left.simplify(), this.right.simplify());
  }

  keyPaths(): string[] {
    return _.uniq([
      ...this.left.keyPaths(),
      ...this.right.keyPaths(),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryComparisonExpression(this.type, this.left.mapKey(callback), this.right.mapKey(callback));
  }

  eval(value: any) {
    switch (this.type) {
      case '$eq': return this.left.eval(value) === this.right.eval(value);
      case '$gt': return this.left.eval(value) > this.right.eval(value);
      case '$gte': return this.left.eval(value) >= this.right.eval(value);
      case '$lt': return this.left.eval(value) < this.right.eval(value);
      case '$lte': return this.left.eval(value) <= this.right.eval(value);
      case '$ne': return this.left.eval(value) !== this.right.eval(value);
    }
  }
}

export class QueryNotExpression extends QueryExpression {

  expr: QueryExpression;

  constructor(expr: QueryExpression) {
    super();
    this.expr = expr;
  }

  simplify() {
    return new QueryNotExpression(this.expr.simplify());
  }

  keyPaths(): string[] {
    return this.expr.keyPaths();
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryNotExpression(this.expr.mapKey(callback));
  }

  eval(value: any) {
    return !this.expr.eval(value);
  }
}

export class QueryArrayExpression extends QueryExpression {

  exprs: QueryExpression[];

  constructor(exprs: QueryExpression[]) {
    super();
    this.exprs = exprs;
  }

  simplify() {
    return new QueryArrayExpression(_.map(this.exprs, x => x.simplify())) as QueryExpression;
  }

  keyPaths(): string[] {
    return _.uniq(_.flatMap(this.exprs, x => x.keyPaths()));
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryArrayExpression(_.map(this.exprs, x => x.mapKey(callback)));
  }
}

export class QueryDistanceExpression extends QueryExpression {

  type: typeof TDistanceKeys[number];
  left: QueryExpression[];
  right: QueryExpression[];

  constructor(type: typeof TDistanceKeys[number], left: QueryExpression[], right: QueryExpression[]) {
    super();
    this.type = type;
    this.left = left;
    this.right = right;
  }

  simplify() {
    return new QueryDistanceExpression(this.type, _.map(this.left, x => x.simplify()), _.map(this.right, x => x.simplify()));
  }

  keyPaths(): string[] {
    return _.uniq([
      ..._.flatMap(this.left, x => x.keyPaths()),
      ..._.flatMap(this.right, x => x.keyPaths()),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryDistanceExpression(this.type, _.map(this.left, x => x.mapKey(callback)), _.map(this.right, x => x.mapKey(callback)));
  }
}

export class QueryKeyExpression extends QueryExpression {

  key: string;

  constructor(key: string) {
    super();
    this.key = key;
  }

  keyPaths(): string[] {
    return this.key === '$' ? [] : [this.key];
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryKeyExpression(callback(this.key));
  }
}

export class QueryValueExpression extends QueryExpression {

  value: TValue;

  constructor(value: TValue) {
    super();
    this.value = value;
  }
}
