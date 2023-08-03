//
//  parser.ts
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
  TValue,
  isValue,
  TQuerySelector,
  TCoditionalKeys,
  TFieldQuerySelector,
  TComparisonKeys,
  TValueListKeys,
  allFieldQueryKeys,
  TValueSetKeys,
} from '../../../internals';

export class QuerySelector {

  static decode(selectors: _.Many<TQuerySelector>, dollerSign: boolean = false): QuerySelector {
    const exprs: QuerySelector[] = [];
    for (const selector of _.castArray(selectors)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (key in TCoditionalKeys && _.isArray(query)) {
          exprs.push(new CoditionalSelector(key as any, _.map(query, x => QuerySelector.decode(x))));
        } else if (dollerSign && key === '$' && !_.isArray(query)) {
          exprs.push(new FieldSelector(key, FieldExpression.decode(query)));
        } else if (!key.startsWith('$') && !_.isArray(query)) {
          exprs.push(new FieldSelector(key, FieldExpression.decode(query)));
        } else {
          throw Error('Invalid expression');
        }
      }
    }
    if (_.isEmpty(exprs)) return new QuerySelector;
    return (exprs.length === 1 ? exprs[0] : new CoditionalSelector('$and', exprs)).simplify();
  }

  simplify(): QuerySelector {
    return this;
  }

  validate(callback: (key: string) => boolean) {
    return true;
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

  simplify() {
    if (_.isEmpty(this.exprs)) return new QuerySelector;
    if (this.exprs.length === 1 && this.type !== '$nor') return this.exprs[0];
    switch (this.type) {
      case '$and':
        return new CoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalSelector && x.type === '$and' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QuerySelector;
      case '$nor':
      case '$or':
        return new CoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalSelector && x.type === '$or' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        )) as QuerySelector;
    }
  }

  validate(callback: (key: string) => boolean) {
    return _.every(this.exprs, x => x.validate(callback));
  }
}

export class FieldExpression {

  type: keyof TFieldQuerySelector;
  value: QuerySelector | FieldExpression | RegExp | TValue;

  constructor(type: keyof TFieldQuerySelector, value: QuerySelector | FieldExpression | RegExp | TValue) {
    this.type = type;
    this.value = value;
  }

  static decode(selector: TFieldQuerySelector): FieldExpression {
    for (const [type, expr] of _.toPairs(selector)) {
      if (type in TComparisonKeys) {
        if (!isValue(expr)) throw Error('Invalid expression');
        return new FieldExpression(type as any, expr);
      } else if (type in TValueListKeys || type in TValueSetKeys) {
        if (!isValue(expr) || !_.isArray(expr)) throw Error('Invalid expression');
        return new FieldExpression(type as any, expr);
      } else {
        switch (type) {
          case '$not':
            {
              const _expr = expr ? { ...expr as any } : {};
              const keys = _.keys(_expr);
              if (keys.length !== 1 && !allFieldQueryKeys.includes(keys[0])) throw Error('Invalid expression');
              return new FieldExpression(type, FieldExpression.decode(_expr));
            }
          case '$type':
            if (_.isString(expr)) {
              return new FieldExpression(type, expr);
            } else if (_.isArray(expr) && _.every(expr, x => _.isString(x))) {
              return new FieldExpression(type, expr);
            } else {
              throw Error('Invalid expression');
            }
          case '$pattern':
            if (_.isString(expr) || _.isRegExp(expr)) {
              return new FieldExpression(type, expr);
            } else {
              throw Error('Invalid expression');
            }
          case '$size':
            if (_.isNumber(expr)) {
              return new FieldExpression(type, expr);
            } else {
              throw Error('Invalid expression');
            }
          case '$every':
          case '$some':
            return new FieldExpression(type, QuerySelector.decode(expr ? { ...expr as any } : {}, true));
          default: throw Error('Invalid expression');
        }
      }
    }
    throw Error('Implemented');
  }

  simplify(): FieldExpression {
    if (this.value instanceof QuerySelector) {
      return new FieldExpression(this.type, this.value.simplify());
    }
    if (this.value instanceof FieldExpression) {
      return new FieldExpression(this.type, this.value.simplify());
    }
    return this;
  }

  validate(callback: (key: string) => boolean): boolean {
    if (this.value instanceof QuerySelector) {
      return this.value.validate(callback);
    }
    if (this.value instanceof FieldExpression) {
      return this.value.validate(callback);
    }
    return true;
  }
}

export class FieldSelector extends QuerySelector {

  field: string;
  expr: FieldExpression;

  constructor(field: string, expr: FieldExpression) {
    super();
    this.field = field;
    this.expr = expr;
  }

  simplify() {
    return new FieldSelector(this.field, this.expr.simplify());
  }

  validate(callback: (key: string) => boolean) {
    return (this.field === '$' || callback(this.field)) && this.expr.validate(callback);
  }
}
