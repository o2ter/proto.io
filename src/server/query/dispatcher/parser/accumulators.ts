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
import { TUnaryAccumulatorKeys, TZeroParamAccumulatorKeys, TQueryAccumulator } from '../../../../internals/query/types/accumulators';
import { QueryExpression } from './expressions';
import { _isTypeof, TSchema } from '../../../../internals/schema';

export class QueryAccumulator {

  static decode(query: TQueryAccumulator): QueryAccumulator {
    for (const [key, expr] of _.toPairs(query)) {
      if (_.includes(TUnaryAccumulatorKeys, key)) {
        return new QueryUnaryAccumulator(key as typeof TUnaryAccumulatorKeys[number], QueryExpression.decode(expr as any ?? [], false));
      } else if (_.includes(TZeroParamAccumulatorKeys, key)) {
        return new QueryZeroParamAccumulator(key as typeof TZeroParamAccumulatorKeys[number]);
      } else if (key === '$percentile') {
        const { input, p, mode = 'discrete' } = expr as any ?? {};
        if (!_.isFinite(p) || p < 0 || p > 1) throw Error('Invalid expression');
        if (!_.includes(['discrete', 'continuous'], mode)) throw Error('Invalid expression');
        return new QueryPercentileAccumulator(QueryExpression.decode(input ?? [], false), p, mode);
      } else if (key === '$group') {
        const { key: groupKey, value } = expr as any ?? {};
        if (!groupKey || !value) throw Error('Invalid expression');
        return new QueryGroupAccumulator(
          QueryExpression.decode(groupKey ?? [], false),
          QueryAccumulator.decode(value)
        );
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

export class QueryZeroParamAccumulator extends QueryAccumulator {

  type: typeof TZeroParamAccumulatorKeys[number];

  constructor(type: typeof TZeroParamAccumulatorKeys[number]) {
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

export class QueryUnaryAccumulator extends QueryAccumulator {

  type: typeof TUnaryAccumulatorKeys[number];
  expr: QueryExpression;

  constructor(type: typeof TUnaryAccumulatorKeys[number], expr: QueryExpression) {
    super();
    this.type = type;
    this.expr = expr;
  }

  simplify() {
    return new QueryUnaryAccumulator(this.type, this.expr.simplify());
  }

  keyPaths() {
    return this.expr.keyPaths();
  }

  mapKey(callback: (key: string) => string) {
    return new QueryUnaryAccumulator(this.type, this.expr.mapKey(callback));
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    const [dataType] = this.expr.evalType(schema, className);
    if (_.isNil(dataType)) return;
    switch (this.type) {
      case '$max': return _isTypeof(dataType, ['number', 'decimal', 'string', 'date']) ? dataType : undefined;
      case '$min': return _isTypeof(dataType, ['number', 'decimal', 'string', 'date']) ? dataType : undefined;
      case '$most': return _isTypeof(dataType, ['number', 'decimal', 'string', 'date']) ? dataType : undefined;
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

export class QueryPercentileAccumulator extends QueryAccumulator {

  input: QueryExpression;
  p: number;
  mode: 'discrete' | 'continuous';

  constructor(input: QueryExpression, p: number, mode: 'discrete' | 'continuous') {
    super();
    this.input = input;
    this.p = p;
    this.mode = mode;
  }

  simplify(): QueryAccumulator {
    return new QueryPercentileAccumulator(this.input.simplify(), this.p, this.mode);
  }

  keyPaths(): string[] {
    return this.input.keyPaths();
  }

  mapKey(callback: (key: string) => string): QueryAccumulator {
    return new QueryPercentileAccumulator(this.input.mapKey(callback), this.p, this.mode);
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    const [dataType] = this.input.evalType(schema, className);
    if (this.mode === 'continuous') {
      return _isTypeof(dataType, ['number', 'decimal']) ? dataType : undefined;
    }
    return dataType;
  }
}

export class QueryGroupAccumulator extends QueryAccumulator {

  key: QueryExpression;
  value: QueryAccumulator;

  constructor(key: QueryExpression, value: QueryAccumulator) {
    super();
    this.key = key;
    this.value = value;
  }

  simplify(): QueryAccumulator {
    return new QueryGroupAccumulator(this.key.simplify(), this.value.simplify());
  }

  keyPaths(): string[] {
    return _.uniq([
      ...this.key.keyPaths(),
      ...this.value.keyPaths(),
    ]);
  }

  mapKey(callback: (key: string) => string): QueryAccumulator {
    return new QueryGroupAccumulator(this.key.mapKey(callback), this.value.mapKey(callback));
  }

  evalType(schema: Record<string, TSchema>, className: string): TSchema.DataType | undefined {
    return this.value.evalType(schema, className);
  }
}
