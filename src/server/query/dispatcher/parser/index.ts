//
//  index.ts
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
import { QueryExpression } from './expressions';
import { TFieldQuerySelector, TQuerySelector, allFieldQueryKeys } from '../../../../internals/query/types/selectors';
import { TComparisonKeys, TConditionalKeys, TValueListKeys, TValueSetKeys } from '../../../../internals/query/types/keys';
import { isValue } from '../../../../internals/object';
import { TValue } from '../../../../internals/types';
import { equal, getValue, greaterThan, greaterThanOrEqual, isIntersect, isSubset, isSuperset, lessThan, lessThanOrEqual } from './utils';

export class QuerySelector {

  static decode(selectors: _.Many<TQuerySelector>, dollerSign: boolean = false): QuerySelector {
    const exprs: QuerySelector[] = [];
    for (const selector of _.castArray(selectors)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (_.includes(TConditionalKeys, key) && _.isArray(query)) {
          exprs.push(new QueryCoditionalSelector(key as any, _.map(query, x => QuerySelector.decode(x, dollerSign))));
        } else if (key === '$expr') {
          exprs.push(new QueryExpressionSelector(QueryExpression.decode(query as any, dollerSign)));
        } else if (dollerSign && key === '$' && !_.isArray(query)) {
          exprs.push(new QueryFieldSelector(key, FieldSelectorExpression.decode(query)));
        } else if (!key.startsWith('$') && !_.isArray(query)) {
          exprs.push(new QueryFieldSelector(key, FieldSelectorExpression.decode(query)));
        } else {
          throw Error('Invalid expression');
        }
      }
    }
    if (_.isEmpty(exprs)) return new QuerySelector;
    return (exprs.length === 1 ? exprs[0] : new QueryCoditionalSelector('$and', exprs)).simplify();
  }

  simplify(): QuerySelector {
    return this;
  }

  keyPaths(): string[] {
    return [];
  }

  eval(value: any): boolean {
    return true;
  }
}

export class QueryCoditionalSelector extends QuerySelector {

  type: typeof TConditionalKeys[number];
  exprs: QuerySelector[];

  constructor(type: typeof TConditionalKeys[number], exprs: QuerySelector[]) {
    super();
    this.type = type;
    this.exprs = exprs;
  }

  simplify() {
    if (_.isEmpty(this.exprs)) return new QuerySelector;
    if (this.exprs.length === 1 && this.type !== '$nor') return this.exprs[0];
    switch (this.type) {
      case '$and':
        return new QueryCoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof QueryCoditionalSelector && x.type === '$and' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QuerySelector;
      case '$nor':
      case '$or':
        return new QueryCoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof QueryCoditionalSelector && x.type === '$or' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QuerySelector;
    }
  }

  keyPaths(): string[] {
    return _.uniq(_.flatMap(this.exprs, x => x.keyPaths()));
  }

  eval(value: any) {
    switch (this.type) {
      case '$and': return _.every(this.exprs, expr => expr.eval(value));
      case '$nor': return !_.some(this.exprs, expr => expr.eval(value));
      case '$or': return _.some(this.exprs, expr => expr.eval(value));
    }
  }
}

export class FieldSelectorExpression {

  type: keyof TFieldQuerySelector;
  value: QuerySelector | FieldSelectorExpression | RegExp | TValue;

  constructor(type: keyof TFieldQuerySelector, value: QuerySelector | FieldSelectorExpression | RegExp | TValue) {
    this.type = type;
    this.value = value;
  }

  static decode(selector: TFieldQuerySelector): FieldSelectorExpression {
    for (const [type, expr] of _.toPairs(selector)) {
      if (_.includes(TComparisonKeys, type)) {
        if (!isValue(expr)) throw Error('Invalid expression');
        return new FieldSelectorExpression(type as any, expr);
      } else if (_.includes(TValueListKeys, type) || _.includes(TValueSetKeys, type)) {
        if (!isValue(expr) || !_.isArray(expr)) throw Error('Invalid expression');
        return new FieldSelectorExpression(type as any, expr);
      } else {
        switch (type) {
          case '$not':
            {
              const _expr = expr ? { ...expr as any } : {};
              const keys = _.keys(_expr);
              if (keys.length !== 1 && !allFieldQueryKeys.includes(keys[0])) throw Error('Invalid expression');
              return new FieldSelectorExpression(type, FieldSelectorExpression.decode(_expr));
            }
          case '$pattern':
            if (!_.isString(expr) && !_.isRegExp(expr)) throw Error('Invalid expression');
            return new FieldSelectorExpression(type, expr);
          case '$starts':
          case '$ends':
            if (!_.isString(expr)) throw Error('Invalid expression');
            return new FieldSelectorExpression(type, expr);
          case '$size':
            if (!_.isNumber(expr)) throw Error('Invalid expression');
            return new FieldSelectorExpression(type, expr);
          case '$empty':
            if (!_.isBoolean(expr)) throw Error('Invalid expression');
            return new FieldSelectorExpression(type, expr);
          case '$every':
          case '$some':
            return new FieldSelectorExpression(type, QuerySelector.decode(expr ? { ...expr as any } : {}, true));
          default: throw Error('Invalid expression');
        }
      }
    }
    throw Error('Invalid expression');
  }

  simplify(): FieldSelectorExpression {
    if (this.value instanceof QuerySelector) {
      return new FieldSelectorExpression(this.type, this.value.simplify());
    }
    if (this.value instanceof FieldSelectorExpression) {
      return new FieldSelectorExpression(this.type, this.value.simplify());
    }
    return this;
  }

  keyPaths(field?: string): string[] {
    let result: string[] = [];
    if (this.value instanceof QuerySelector) {
      result = this.value.keyPaths();
    } else if (this.value instanceof FieldSelectorExpression) {
      switch (this.type) {
        case '$every':
        case '$some':
          result = this.value.keyPaths();
        default:
          result = this.value.keyPaths();
      }
    }
    return field ? result.map(x => `${field}.${x}`) : result;
  }

  eval(value: any): any {
    if (_.includes(TComparisonKeys, this.type)) {
      switch (this.type) {
        case '$eq': return equal(value, this.value);
        case '$gt': return greaterThan(value, this.value);
        case '$gte': return greaterThanOrEqual(value, this.value);
        case '$lt': return lessThan(value, this.value);
        case '$lte': return lessThanOrEqual(value, this.value);
        case '$ne': return !equal(value, this.value);
      }
    } else if (_.includes(TValueListKeys, this.type) || _.includes(TValueSetKeys, this.type)) {
      switch (this.type) {
        case '$in': return _.isArray(value) && _.some(value, x => equal(x, this.value));
        case '$nin': return _.isArray(value) && !_.some(value, x => equal(x, this.value));
        case '$subset': return _.isArray(value) && _.isArray(this.value) && isSubset(value, this.value);
        case '$superset': return _.isArray(value) && _.isArray(this.value) && isSuperset(value, this.value);
        case '$intersect': return _.isArray(value) && _.isArray(this.value) && isIntersect(value, this.value);
      }
    } else {
      switch (this.type) {
        case '$not':
          return this.value instanceof FieldSelectorExpression && !this.value.eval(value);
        case '$pattern':
          if (_.isString(this.value)) {
            return _.isString(value) && value.includes(this.value);
          }
          if (_.isRegExp(this.value)) {
            return _.isString(value) && !!value.match(this.value);
          }
          return false;
        case '$starts':
          return _.isString(this.value) && _.isString(value) && value.startsWith(this.value);
        case '$ends':
          return _.isString(this.value) && _.isString(value) && value.endsWith(this.value);
        case '$size':
          return _.isNumber(this.value) && (_.isString(value) || _.isArray(value)) && value.length === this.value;
        case '$empty':
          return _.isBoolean(this.value) && (_.isString(value) || _.isArray(value)) && _.isEmpty(value);
        case '$every':
          {
            const expr = this.value;
            return expr instanceof QuerySelector && _.isArray(value) && _.every(value, x => expr.eval(x));
          }
        case '$some':
          {
            const expr = this.value;
            return expr instanceof QuerySelector && _.isArray(value) && _.some(value, x => expr.eval(x));
          }
        default: break;
      }
    }
    throw Error('Invalid expression');
  }
}

export class QueryFieldSelector extends QuerySelector {

  field: string;
  expr: FieldSelectorExpression;

  constructor(field: string, expr: FieldSelectorExpression) {
    super();
    this.field = field;
    this.expr = expr;
  }

  simplify() {
    return new QueryFieldSelector(this.field, this.expr.simplify());
  }

  keyPaths(): string[] {
    return this.field === '$' ? this.expr.keyPaths() : [this.field, ...this.expr.keyPaths(this.field)];
  }

  eval(value: any) {
    return this.expr.eval(this.field === '$' ? value : getValue(value, this.field));
  }
}

export class QueryExpressionSelector extends QuerySelector {

  expr: QueryExpression;

  constructor(expr: QueryExpression) {
    super();
    this.expr = expr;
  }

  simplify() {
    return new QueryExpressionSelector(this.expr.simplify());
  }

  keyPaths(): string[] {
    return this.expr.keyPaths();
  }

  eval(value: any) {
    return !!this.expr.eval(value);
  }
}
