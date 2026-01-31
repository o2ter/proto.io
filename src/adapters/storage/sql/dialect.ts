//
//  dialect.ts
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

import { FieldSelectorExpression } from '../../../server/query/dispatcher/parser';
import { QueryExpression } from '../../../server/query/dispatcher/parser/expressions';
import { QueryAccumulator } from '../../../server/query/dispatcher/parser/accumulators';
import { TSchema } from '../../../internals/schema';
import { Populate, QueryCompiler, QueryContext } from './compiler';
import { SQL } from './sql';
import { TValue, TValueWithUndefined } from '../../../internals/types';
import { TUpdateOp } from '../../../internals/object/types';
import { RelationOptions } from '../../../server/storage';

export interface SqlDialect {
  quote(str: string): string;
  identifier(name: string): string;
  placeholder(idx: number): string;
  boolean(value: boolean): string;
  encodeType(colname: string, type: TSchema.DataType, value: TValueWithUndefined): SQL;
  decodeType(type: TSchema.Primitive | 'vector', value: any): TValue;
  updateOperation(paths: string[], dataType: TSchema.DataType, operation: TUpdateOp): SQL;

  selectPopulate(
    compiler: QueryCompiler,
    parent: QueryContext & { className: string; },
    populate: Populate,
    field: string,
  ): { columns: SQL[], join?: SQL }

  encodeFieldExpression(
    compiler: QueryCompiler,
    parent: QueryContext,
    field: string,
    expr: FieldSelectorExpression,
  ): SQL

  encodeSortExpression(
    compiler: QueryCompiler,
    parent: QueryContext,
    expr: QueryExpression,
  ): SQL | undefined

  encodeBooleanExpression(
    compiler: QueryCompiler,
    parent: QueryContext,
    expr: QueryExpression,
  ): SQL | undefined

  encodePopulate(
    compiler: QueryCompiler,
    parent: Populate,
    remix?: QueryContext & { className: string; }
  ): Record<string, SQL>

  encodeRelation(
    compiler: QueryCompiler,
    parent: QueryContext & { className: string; },
    relatedBy: NonNullable<RelationOptions['relatedBy']>
  ): SQL

  encodeSortKey(
    compiler: QueryCompiler,
    parent: QueryContext,
    key: string
  ): SQL

  encodeAccumulatorColumn(
    compiler: QueryCompiler,
    context: QueryContext,
    expr: QueryAccumulator,
    fetchName: string
  ): SQL

  random(weight?: SQL): SQL
}
