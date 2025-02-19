//
//  vector.ts
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
import { isVector } from '../../../../../../internals/schema';
import { QueryExpression, QueryKeyExpression, QueryValueExpression, QueryDistanceExpression } from '../../../../../../server/query/dispatcher/parser/expressions';
import { sql, SQL } from '../../../../sql';
import { QueryCompiler, QueryContext } from '../../../../sql/compiler';
import { encodeTypedQueryExpression } from './expr';
import { fetchElement } from '../utils';
import { typeCastExpr } from './types';

const encodeVectorExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  exprs: QueryExpression[]
) => {
  if (exprs.length === 1) {
    const [expr] = exprs;
    if (expr instanceof QueryKeyExpression) {
      const { element, dataType } = fetchElement(compiler, parent, expr.key);
      if (!dataType || !isVector(dataType)) throw Error('Invalid expression');
      return { sql: element, dimension: dataType.dimension };
    }
    if (expr instanceof QueryValueExpression) {
      if (!_.isArray(expr.value) || !_.every(expr.value, x => _.isFinite(x))) throw Error('Invalid expression');
      return { sql: sql`${{ value: expr.value }}::DOUBLE PRECISION[]`, dimension: expr.value.length };
    }
  }
  const result = _.compact(_.map(exprs, x => typeCastExpr(encodeTypedQueryExpression(compiler, parent, x), 'number')?.sql));
  if (result.length !== exprs.length) throw Error('Invalid expression');
  return { sql: sql`ARRAY[${_.map(result, x => sql`COALESCE(${x}, 0)`)}]`, dimension: result.length };
};

export const encodeDistanceQueryExpression = (
  compiler: QueryCompiler,
  parent: QueryContext,
  expr: QueryDistanceExpression
): SQL => {

  const { sql: left, dimension: d1 } = encodeVectorExpression(compiler, parent, expr.left);
  const { sql: right, dimension: d2 } = encodeVectorExpression(compiler, parent, expr.right);
  if (d1 !== d2) throw Error('Invalid expression');

  const operatorMap = {
    '$distance': sql`<->`,
    '$innerProduct': sql`<#>`,
    '$negInnerProduct': sql`<#>`,
    '$cosineDistance': sql`<=>`,
    '$rectilinearDistance': sql`<+>`,
  } as const;

  const _expr = sql`
    CAST(
      ${left} AS VECTOR(${{ literal: `${d1}` }})
    )
    ${operatorMap[expr.type]} 
    CAST(
      ${right} AS VECTOR(${{ literal: `${d2}` }})
    )
  `;

  return expr.type === '$innerProduct' ? sql`-1 * (${_expr})` : _expr;
};
