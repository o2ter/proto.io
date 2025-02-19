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
import { TBinaryExprKeys, TDistanceExprKeys, TExpression, TListExprKeys, TNoParamExprKeys, TUnaryExprKeys } from '../../../../internals/query/types/expressions';
import { TComparisonKeys, TConditionalKeys } from '../../../../internals/query/types/keys';
import { isValue } from '../../../../internals/object';
import { TValue } from '../../../../internals/types';
import { cosine, distance, equal, getValue, greaterThan, greaterThanOrEqual, innerProduct, lessThan, lessThanOrEqual, rectilinearDistance } from './utils';
import { TSchema } from '../../../../internals/schema';
import { resolveColumn } from '../validator';
import Decimal from 'decimal.js';

export class QueryExpression {

  static decode(expr: _.Many<TExpression>, dollerSign: boolean): QueryExpression {
    const exprs: QueryExpression[] = [];
    for (const selector of _.castArray(expr)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (_.includes(TConditionalKeys, key) && _.isArray(query)) {
          exprs.push(new QueryCoditionalExpression(key as any, _.map(query, x => QueryExpression.decode(x as any, dollerSign))));
        } else if (_.includes(TNoParamExprKeys, key)) {
          exprs.push(new QueryNoParamExpression(key as any));
        } else if (_.includes(TUnaryExprKeys, key) && _.isArray(query) && query.length === 1) {
          exprs.push(new QueryUnaryExpression(key as any, QueryExpression.decode(query[0] as any, dollerSign)));
        } else if (_.includes(TBinaryExprKeys, key) && _.isArray(query) && query.length === 2) {
          const [left, right] = query;
          exprs.push(new QueryBinaryExpression(key as any, QueryExpression.decode(left as any, dollerSign), QueryExpression.decode(right as any, dollerSign)));
        } else if (_.includes(TListExprKeys, key) && _.isArray(query)) {
          exprs.push(new QueryListExpression(key as any, _.map(query, x => QueryExpression.decode(x as any, dollerSign))));
        } else if (_.includes(TComparisonKeys, key) && _.isArray(query) && query.length === 2) {
          const [left, right] = query;
          exprs.push(new QueryComparisonExpression(key as any, QueryExpression.decode(left as any, dollerSign), QueryExpression.decode(right as any, dollerSign)));
        } else if (_.includes(TDistanceExprKeys, key) && _.isArray(query) && query.length === 2) {
          const [left, right] = query;
          const _left = _.isArray(left) ? _.map(left, x => QueryExpression.decode(x as any, dollerSign)) : QueryExpression.decode(left as any, dollerSign);
          const _right = _.isArray(right) ? _.map(right, x => QueryExpression.decode(x as any, dollerSign)) : QueryExpression.decode(right as any, dollerSign);
          exprs.push(new QueryDistanceExpression(key as any, _.castArray(_left), _.castArray(_right)));
        } else if (key === '$cond' && _.isPlainObject(query)) {
          const { if: cond, then, else: elseCase } = query as any;
          exprs.push(new QueryCondExpression(QueryExpression.decode(cond as any, dollerSign), QueryExpression.decode(then as any, dollerSign), QueryExpression.decode(elseCase as any, dollerSign)));
        } else if (key === '$switch' && _.isPlainObject(query)) {
          const { branches, default: defaultCase } = query as any;
          exprs.push(new QuerySwitchExpression(
            _.map(branches as any, ({ case: c, then: t }) => ({ case: QueryExpression.decode(c as any, dollerSign), then: QueryExpression.decode(t as any, dollerSign) })),
            QueryExpression.decode(defaultCase as any, dollerSign)
          ));
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

  eval(value: any): any {
    return true;
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return [];
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

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return ['boolean'];
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
      case '$eq': return equal(this.left.eval(value), this.right.eval(value));
      case '$gt': return greaterThan(this.left.eval(value), this.right.eval(value));
      case '$gte': return greaterThanOrEqual(this.left.eval(value), this.right.eval(value));
      case '$lt': return lessThan(this.left.eval(value), this.right.eval(value));
      case '$lte': return lessThanOrEqual(this.left.eval(value), this.right.eval(value));
      case '$ne': return !equal(this.left.eval(value), this.right.eval(value));
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return ['boolean'];
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

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return ['boolean'];
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

  eval(value: any) {
    return _.map(this.exprs, x => x.eval(value));
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return ['array'];
  }
}

export class QueryNoParamExpression extends QueryExpression {

  type: typeof TNoParamExprKeys[number];

  constructor(type: typeof TNoParamExprKeys[number]) {
    super();
    this.type = type;
  }

  eval(value: any): any {
    switch (this.type) {
      case '$now': return new Date();
      case '$rand': return Math.random();
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    switch (this.type) {
      case '$now': return ['date'];
      case '$rand': return ['number', 'decimal'];
    }
  }
}

export class QueryUnaryExpression extends QueryExpression {

  type: typeof TUnaryExprKeys[number];
  expr: QueryExpression;

  constructor(type: typeof TUnaryExprKeys[number], expr: QueryExpression) {
    super();
    this.type = type;
    this.expr = expr;
  }

  simplify() {
    return new QueryUnaryExpression(this.type, this.expr.simplify());
  }

  keyPaths(): string[] {
    return this.expr.keyPaths();
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryUnaryExpression(this.type, this.expr.mapKey(callback));
  }

  eval(value: any) {
    switch (this.type) {
      case '$abs': return Math.abs(this.expr.eval(value));
      case '$sqrt': return Math.sqrt(this.expr.eval(value));
      case '$ceil': return Math.ceil(this.expr.eval(value));
      case '$floor': return Math.floor(this.expr.eval(value));
      case '$round': return Math.round(this.expr.eval(value));
      case '$exp': return Math.exp(this.expr.eval(value));
      case '$ln': return Math.log(this.expr.eval(value));
      case '$log2': return Math.log2(this.expr.eval(value));
      case '$log10': return Math.log10(this.expr.eval(value));
      case '$sin': return Math.sin(this.expr.eval(value));
      case '$cos': return Math.cos(this.expr.eval(value));
      case '$tan': return Math.tan(this.expr.eval(value));
      case '$asin': return Math.asin(this.expr.eval(value));
      case '$acos': return Math.acos(this.expr.eval(value));
      case '$atan': return Math.atan(this.expr.eval(value));
      case '$asinh': return Math.asinh(this.expr.eval(value));
      case '$acosh': return Math.acosh(this.expr.eval(value));
      case '$atanh': return Math.atanh(this.expr.eval(value));
      case '$sinh': return Math.sinh(this.expr.eval(value));
      case '$cosh': return Math.cosh(this.expr.eval(value));
      case '$tanh': return Math.tanh(this.expr.eval(value));
      case '$size':
        {
          const v = this.expr.eval(value);
          if (!_.isArray(v) && !_.isString(v)) throw Error('Invalid value');
          return v.length;
        }
      case '$lower': return _.toLower(this.expr.eval(value));
      case '$upper': return _.toUpper(this.expr.eval(value));
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    switch (this.type) {
      case '$abs': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$sqrt': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$ceil': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$floor': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$round': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$exp': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$ln': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$log2': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$log10': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$sin': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$cos': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$tan': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$asin': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$acos': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$atan': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$asinh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$acosh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$atanh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$sinh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$cosh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$tanh': return _.intersection(this.expr.evalType(schema, className), ['number', 'decimal']);
      case '$size': return ['number'];
      case '$lower': return ['string'];
      case '$upper': return ['string'];
    }
  }
}

export class QueryBinaryExpression extends QueryExpression {

  type: typeof TBinaryExprKeys[number];
  left: QueryExpression;
  right: QueryExpression;

  constructor(type: typeof TBinaryExprKeys[number], left: QueryExpression, right: QueryExpression) {
    super();
    this.type = type;
    this.left = left;
    this.right = right;
  }

  simplify() {
    return new QueryBinaryExpression(this.type, this.left.simplify(), this.right.simplify());
  }

  keyPaths(): string[] {
    return _.uniq([
      ...this.left.keyPaths(),
      ...this.right.keyPaths(),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryBinaryExpression(this.type, this.left.mapKey(callback), this.right.mapKey(callback));
  }

  eval(value: any) {
    switch (this.type) {
      case '$mod': return this.left.eval(value) % this.right.eval(value);
      case '$log': return Math.log(this.left.eval(value)) / Math.log(this.right.eval(value));
      case '$pow': return Math.pow(this.left.eval(value), this.right.eval(value));
      case '$divide': return this.left.eval(value) / this.right.eval(value);
      case '$subtract': return this.left.eval(value) - this.right.eval(value);
      case '$trunc':
        {
          const precision = this.right.eval(value);
          const factor = Math.pow(10, precision);
          return Math.trunc(this.left.eval(value) * factor) / factor;
        }
      case '$atan2': return Math.atan2(this.left.eval(value), this.right.eval(value));
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    switch (this.type) {
      case '$mod': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$log': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$pow': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$divide': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$subtract': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$trunc': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
      case '$atan2': return _.intersection(this.left.evalType(schema, className), this.right.evalType(schema, className), ['number', 'decimal']);
    }
  }
}

export class QueryListExpression extends QueryExpression {

  type: typeof TListExprKeys[number];
  exprs: QueryExpression[];

  constructor(type: typeof TListExprKeys[number], exprs: QueryExpression[]) {
    super();
    this.type = type;
    this.exprs = exprs;
  }

  simplify() {
    return new QueryListExpression(this.type, _.map(this.exprs, x => x.simplify())) as QueryExpression;
  }

  keyPaths(): string[] {
    return _.uniq(_.flatMap(this.exprs, x => x.keyPaths()));
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryListExpression(this.type, _.map(this.exprs, x => x.mapKey(callback)));
  }

  eval(value: any) {
    switch (this.type) {
      case '$add': return _.isEmpty(this.exprs) ? undefined : _.sum(_.map(this.exprs, x => x.eval(value)));
      case '$multiply': return _.isEmpty(this.exprs) ? undefined : _.reduce(_.map(this.exprs, x => x.eval(value)), (a, b) => a * b, 1);
      case '$ifNull': return _.find(_.map(this.exprs, x => x.eval(value)), x => !_.isNil(x));
      case '$concat': return _.join(_.map(this.exprs, x => x.eval(value)), '');
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    switch (this.type) {
      case '$add': return _.intersection(..._.map(this.exprs, x => x.evalType(schema, className)), ['number', 'decimal']);
      case '$multiply': return _.intersection(..._.map(this.exprs, x => x.evalType(schema, className)), ['number', 'decimal']);
      case '$ifNull': return _.intersection(..._.map(this.exprs, x => x.evalType(schema, className)));
      case '$concat': return ['string'];
    }
  }
}

export class QueryCondExpression extends QueryExpression {

  cond: QueryExpression;
  then: QueryExpression;
  else: QueryExpression;

  constructor(cond: QueryExpression, then: QueryExpression, elseCase: QueryExpression) {
    super();
    this.cond = cond;
    this.then = then;
    this.else = elseCase;
  }

  simplify() {
    return new QueryCondExpression(this.cond.simplify(), this.then.simplify(), this.else.simplify());
  }

  keyPaths(): string[] {
    return _.uniq([
      ...this.cond.keyPaths(),
      ...this.then.keyPaths(),
      ...this.else.keyPaths(),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QueryCondExpression(this.cond.mapKey(callback), this.then.mapKey(callback), this.else.mapKey(callback));
  }

  eval(value: any) {
    return this.cond.eval(value) ? this.then.eval(value) : this.else.eval(value);
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return _.intersection(this.then.evalType(schema, className), this.else.evalType(schema, className));
  }
}

export class QuerySwitchExpression extends QueryExpression {

  branches: { case: QueryExpression; then: QueryExpression; }[];
  default: QueryExpression;

  constructor(branches: { case: QueryExpression; then: QueryExpression; }[], defaultCase: QueryExpression) {
    super();
    this.branches = branches;
    this.default = defaultCase;
  }

  simplify() {
    return new QuerySwitchExpression(
      _.map(this.branches, ({ case: c, then: t }) => ({ case: c.simplify(), then: t.simplify() })),
      this.default.simplify()
    );
  }

  keyPaths(): string[] {
    return _.uniq([
      ..._.flatMap(this.branches, ({ case: c, then: t }) => [...c.keyPaths(), ...t.keyPaths()]),
      ...this.default.keyPaths(),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryExpression {
    return new QuerySwitchExpression(
      _.map(this.branches, ({ case: c, then: t }) => ({ case: c.mapKey(callback), then: t.mapKey(callback) })),
      this.default.mapKey(callback)
    );
  }

  eval(value: any) {
    for (const { case: c, then: t } of this.branches) {
      if (c.eval(value)) return t.eval(value);
    }
    return this.default.eval(value);
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return _.intersection(
      ..._.map(this.branches, ({ then: t }) => t.evalType(schema, className)),
      this.default.evalType(schema, className)
    );
  }
}

export class QueryDistanceExpression extends QueryExpression {

  type: typeof TDistanceExprKeys[number];
  left: QueryExpression[];
  right: QueryExpression[];

  constructor(type: typeof TDistanceExprKeys[number], left: QueryExpression[], right: QueryExpression[]) {
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

  eval(value: any) {
    const left = this.left.length === 1 ? this.left[0].eval(value) : _.map(this.left, x => x.eval(value));
    const right = this.right.length === 1 ? this.right[0].eval(value) : _.map(this.right, x => x.eval(value));
    if (!_.isArray(left) || !_.every(left, x => _.isFinite(x))) throw Error('Invalid vectors');
    if (!_.isArray(right) || !_.every(right, x => _.isFinite(x))) throw Error('Invalid vectors');
    switch (this.type) {
      case '$distance': return distance(left, right);
      case '$innerProduct': return innerProduct(left, right);
      case '$negInnerProduct': return -innerProduct(left, right);
      case '$cosineDistance': return cosine(left, right);
      case '$rectilinearDistance': return rectilinearDistance(left, right);
    }
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    return ['number'];
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

  eval(value: any) {
    return getValue(value, this.key);
  }

  evalType(schema: Record<string, TSchema>, className: string) {
    const { paths: [, ...subpath], dataType } = resolveColumn(schema, className, this.key);
    return _.isEmpty(subpath) ? [dataType] : [];
  }
}

export class QueryValueExpression extends QueryExpression {

  value: TValue;

  constructor(value: TValue) {
    super();
    this.value = value;
  }

  eval(value: any) {
    return value;
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType[] {
    if (_.isDate(this.value)) return ['date'];
    if (_.isBoolean(this.value)) return ['boolean'];
    if (_.isArray(this.value)) return ['array'];
    if (_.isString(this.value)) return ['string'];
    if (_.isNumber(this.value)) return ['number', 'decimal'];
    if (this.value instanceof Decimal) return ['decimal', 'number'];
    return [];
  }
}
