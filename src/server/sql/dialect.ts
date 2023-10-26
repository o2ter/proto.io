//
//  dialect.ts
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

import { TValue, TUpdateOp } from '../../internals';
import { FieldSelectorExpression } from '../query/validator/parser';
import { QueryExpression } from '../query/validator/parser/expressions';
import { TSchema } from '../../internals/schema';
import { CompileContext, Populate, QueryCompiler } from './compiler';
import { SQL } from './sql';

export interface SqlDialect {
  quote(str: string): string;
  identifier(name: string): string;
  placeholder(idx: number): string;
  boolean(value: boolean): string;
  encodeType(colname: string, type: TSchema.DataType, value: TValue): SQL;
  decodeType(type: TSchema.Primitive, value: any): TValue;
  updateOperation(column: string, type: TSchema.DataType, operation: TUpdateOp): SQL;

  selectPopulate(
    compiler: QueryCompiler,
    parent: Pick<Populate, 'className' | 'name' | 'colname' | 'includes'>,
    populate: Populate,
    field: string,
  ): { column: SQL, join?: SQL }

  encodeFieldExpression(
    compiler: QueryCompiler,
    context: CompileContext,
    parent: { className?: string; name: string; },
    field: string,
    expr: FieldSelectorExpression,
  ): SQL

  encodeQueryExpression(
    compiler: QueryCompiler,
    context: CompileContext,
    parent: { className?: string; name: string; },
    expr: QueryExpression,
  ): SQL | undefined

  encodePopulate(
    compiler: QueryCompiler,
    context: CompileContext,
    parent: Populate,
    remix?: { className: string; name: string; }
  ): Record<string, SQL>

  encodeSortKey(
    className: string,
    key: string
  ): SQL

  random(opts: { weight?: string }): SQL
}
