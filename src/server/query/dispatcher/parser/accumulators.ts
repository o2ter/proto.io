//
//  accumulators.ts
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
import { accumulatorExprKeys, accumulatorNoParamKeys, TQueryAccumulator } from '../../../../internals/query/types/accumulators';
import { QueryExpression } from './expressions';
import { _isTypeof, TSchema } from '../../../../internals/schema';

export class QueryAccumulator {

  static decode(query: TQueryAccumulator): QueryAccumulator {
    for (const [key, expr] of _.toPairs(query)) {
      if (_.includes(accumulatorExprKeys, key)) {
        return new QueryExprAccumulator(key as typeof accumulatorExprKeys[number], QueryExpression.decode(expr as any ?? [], false));
      } else if (_.includes(accumulatorNoParamKeys, key)) {
        return new QueryNoParamAccumulator(key as typeof accumulatorNoParamKeys[number]);
      } else {
        throw Error('Invalid expression');
      }
    }
    throw Error('Invalid expression');
  }

  simplify(): QueryAccumulator {
    return this;
  }

  keyPaths(): string[] {
    return [];
  }

  mapKey(callback: (key: string) => string): QueryAccumulator {
    return this;
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    return;
  }
}

export class QueryNoParamAccumulator extends QueryAccumulator {

  type: typeof accumulatorNoParamKeys[number];

  constructor(type: typeof accumulatorNoParamKeys[number]) {
    super();
    this.type = type;
  }

  simplify() {
    return this;
  }

  keyPaths() {
    return [];
  }

  mapKey(callback: (key: string) => string) {
    return this;
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    switch (this.type) {
      case '$count': return 'number';
      default: break;
    }
  }
}

export class QueryExprAccumulator extends QueryAccumulator {

  type: typeof accumulatorExprKeys[number];
  expr: QueryExpression;

  constructor(type: typeof accumulatorExprKeys[number], expr: QueryExpression) {
    super();
    this.type = type;
    this.expr = expr;
  }

  simplify() {
    return new QueryExprAccumulator(this.type, this.expr.simplify());
  }

  keyPaths() {
    return this.expr?.keyPaths() ?? [];
  }

  mapKey(callback: (key: string) => string) {
    return new QueryExprAccumulator(this.type, this.expr.mapKey(callback));
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    const [dataType] = this.expr?.evalType(schema, className) ?? [];
    if (_.isNil(dataType)) return;
    switch (this.type) {
      case '$max': return _isTypeof(dataType, ['number', 'decimal', 'string', 'date']) ? dataType : undefined;
      case '$min': return _isTypeof(dataType, ['number', 'decimal', 'string', 'date']) ? dataType : undefined;
      case '$avg': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      case '$sum': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      case '$stdDevPop': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      case '$stdDevSamp': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      case '$varPop': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      case '$varSamp': return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
      default: break;
    }
  }
}
