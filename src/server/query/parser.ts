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
  TCoditionalQuerySelector,
  TComparisonKeys,
  TValueListKeys,
  allFieldQueryKeys,
} from '../../internals';

export class QuerySelector {

  static decode(selectors: _.Many<TQuerySelector>): QuerySelector {
    const exprs: QuerySelector[] = [];
    for (const selector of _.castArray(selectors)) {
      for (const [key, query] of _.toPairs(selector)) {
        if (key in TCoditionalKeys && _.isArray(query)) {
          exprs.push(new CoditionalSelector(key as any, _.map(query, x => QuerySelector.decode(x))));
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

  validate(fields: string[]) {
    return true;
  }

  encode(): TQuerySelector {
    return {};
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
    switch (this.type) {
      case '$and':
        return new CoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalSelector && x.type === '$and' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        ));
      case '$nor':
      case '$or':
        return new CoditionalSelector(this.type, _.flatMap(
          this.exprs, x => x instanceof CoditionalSelector && x.type === '$or' ? _.map(x.exprs, y => y.simplify()) : [x.simplify()]
        ));
    }
  }

  validate(fields: string[]) {
    return _.every(this.exprs, x => x.validate(fields));
  }

  encode(): TCoditionalQuerySelector {
    return {
      [this.type]: _.map(this.exprs, x => x.encode()),
    };
  }
}

class FieldExpression {

  type: keyof TFieldQuerySelector;
  expr: FieldExpression | QuerySelector | RegExp | TValue;

  constructor(type: keyof TFieldQuerySelector, expr: FieldExpression | QuerySelector | RegExp | TValue) {
    this.type = type;
    this.expr = expr;
  }

  static decode(selector: TFieldQuerySelector): FieldExpression {
    for (const [type, expr] of _.toPairs(selector)) {
      if (type in TComparisonKeys) {
        if (!isValue(expr)) throw Error('Invalid expression');
        return new FieldExpression(type as any, expr);
      } else if (type in TValueListKeys) {
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
          case '$search':
            if (_.isString(expr)) {
              return new FieldExpression(type, expr);
            } else {
              throw Error('Invalid expression');
            }
          case '$regex':
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
          case '$elemMatch':
            {
              const _expr = expr ? { ...expr as any } : {};
              const keys = _.keys(_expr);
              if (_.every(keys, x => allFieldQueryKeys.includes(x))) {
                return new FieldExpression(type, FieldExpression.decode(_expr));
              } else {
                return new FieldExpression(type, QuerySelector.decode(_expr));
              }
            }
          default: throw Error('Invalid expression');
        }
      }
    }
    throw Error('Implemented');
  }

  simplify(): FieldExpression {
    if (this.expr instanceof FieldExpression) {
      return new FieldExpression(this.type, this.expr.simplify());
    }
    if (this.expr instanceof QuerySelector) {
      return new FieldExpression(this.type, this.expr.simplify());
    }
    return new FieldExpression(this.type, this.expr);
  }

  validate(fields: string[]): boolean {
    if (this.expr instanceof FieldExpression) {
      return this.expr.validate(fields);
    }
    if (this.expr instanceof QuerySelector) {
      return this.expr.validate(fields);
    }
    return true;
  }

  encode(): any {
    if (this.expr instanceof FieldExpression) {
      return { [this.type]: this.expr.encode() };
    }
    if (this.expr instanceof QuerySelector) {
      return { [this.type]: this.expr.encode() };
    }
    return { [this.type]: this.expr };
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

  validate(fields: string[]) {
    return fields.includes(this.field) && this.expr.validate(fields);
  }

  encode(): TQuerySelector {
    return {
      [this.field]: this.expr.encode(),
    };
  }
}