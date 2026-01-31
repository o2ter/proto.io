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
import { QueryAccumulator, QueryZeroParamAccumulator, QueryUnaryAccumulator, QueryPercentileAccumulator, QueryGroupAccumulator } from '../../../../../server/query/dispatcher/parser/accumulators';
import { SQL, sql } from '../../../sql';
import { QueryCompiler, Populate, QueryContext } from '../../../sql/compiler';
import { _selectRelationPopulate } from '../populate';
import { encodeTypedQueryExpression } from './expr';

const encodeAccumulatorExpression = (
  compiler: QueryCompiler,
  populate: Populate,
  expr: QueryAccumulator
): SQL => {
  if (expr instanceof QueryZeroParamAccumulator) {
    switch (expr.type) {
      case '$count':
        return sql`COUNT(*)`;
      default:
        throw Error('Invalid expression');
    }
  } else if (expr instanceof QueryUnaryAccumulator) {
    if (!expr.expr) throw Error('Invalid expression');
    const { sql: value } = encodeTypedQueryExpression(compiler, populate, expr.expr) ?? {};
    if (!value) throw Error('Invalid expression');
    switch (expr.type) {
      case '$most':
        return sql`MODE() WITHIN GROUP (ORDER BY (${value}))`;
      default:
        {
          const op = {
            '$max': 'MAX',
            '$min': 'MIN',
            '$avg': 'AVG',
            '$sum': 'SUM',
            '$stdDevPop': 'STDDEV_POP',
            '$stdDevSamp': 'STDDEV_SAMP',
            '$varPop': 'VAR_POP',
            '$varSamp': 'VAR_SAMP',
          }[expr.type];
          return sql`${{ literal: op }}(${value})`;
        }
    }
  } else if (expr instanceof QueryPercentileAccumulator) {
    const op = {
      'discrete': 'PERCENTILE_DISC',
      'continuous': 'PERCENTILE_CONT',
    }[expr.mode];
    if (!expr.input) throw Error('Invalid expression');
    const { sql: value } = encodeTypedQueryExpression(compiler, populate, expr.input) ?? {};
    if (!value) throw Error('Invalid expression');
    return sql`${{ literal: op }}(${{ value: expr.p }}) WITHIN GROUP (ORDER BY (${value}))`;
  } else {
    throw Error('Invalid expression');
  }
};

export const encodeAccumulatorSQL = (
  compiler: QueryCompiler,
  parent: QueryContext & { className: string; },
  populate: Populate,
  field: string,
  expr: QueryAccumulator,
  aliasName: string
): SQL => {
  if (expr instanceof QueryGroupAccumulator) {
    if (!expr.key) throw Error('Invalid expression');
    const { sql: keyValue } = encodeTypedQueryExpression(compiler, populate, expr.key) ?? {};
    if (!keyValue) throw Error('Invalid expression');

    const aggSQL = encodeAccumulatorExpression(compiler, populate, expr.value);

    return sql`
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('key', grouped_key, 'value', grouped_value)
          ),
          '[]'::jsonb
        ) FROM (
          SELECT ${keyValue} AS grouped_key, ${aggSQL} AS grouped_value
          FROM (
            ${_selectRelationPopulate(compiler, parent, populate, field, false)}
          ) ${{ identifier: populate.name }}
          GROUP BY grouped_key
        ) AS _grouped
      ) AS ${{ identifier: aliasName }}
    `;
  }

  const aggSQL = encodeAccumulatorExpression(compiler, populate, expr);

  return sql`
    (
      SELECT ${aggSQL} FROM (
        ${_selectRelationPopulate(compiler, parent, populate, field, false)}
      ) ${{ identifier: populate.name }}
    ) AS ${{ identifier: aliasName }}
  `;
};
