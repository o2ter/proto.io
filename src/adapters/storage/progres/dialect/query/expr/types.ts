//
//  types.ts
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
import { QueryExpression, QueryArrayExpression, QueryValueExpression } from '../../../../../../server/query/dispatcher/parser/expressions';
import { SQL } from '../../../../sql';

const isValueExpression = (expr: QueryExpression): boolean => {
  if (expr instanceof QueryArrayExpression) return _.every(expr.exprs, x => isValueExpression(x));
  return expr instanceof QueryValueExpression;
};

export const isArrayExpression = (expr: QueryExpression) => {
  if (expr instanceof QueryArrayExpression) return true;
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value);
  return false;
};

export const arrayLength = (expr: QueryExpression) => {
  if (expr instanceof QueryArrayExpression) return expr.exprs.length;
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value) ? expr.value.length : 0;
  return 0;
};

export const mapExpression = <R>(expr: QueryExpression, callback: (x: QueryExpression) => R): R[] => {
  if (expr instanceof QueryArrayExpression) return _.map(expr.exprs, x => callback(x));
  if (expr instanceof QueryValueExpression) return _.isArray(expr.value) ? _.map(expr.value, x => callback(new QueryValueExpression(x))) : [];
  return [];
};

export const _PrimitiveValue = ['boolean', 'number', 'decimal', 'string', 'date'] as const;
export type PrimitiveValue = (typeof _PrimitiveValue)[number];

export const matchType = (
  first: { type: PrimitiveValue; sql: SQL; }[] | undefined,
  second: { type: PrimitiveValue; sql: SQL; }[] | undefined
): [{ type: PrimitiveValue; sql: SQL; }, { type: PrimitiveValue; sql: SQL; }] | undefined => {
  const found = _.find(first, l => _.some(second, r => l.type === r.type));
  return found ? [found, _.find(second, r => r.type === found.type)!] : undefined;
};
