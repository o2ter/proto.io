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
import { TSchema } from '../../../internals/schema';
import { Populate, QueryCompiler } from './compiler';
import { SQL } from './sql';
import { TValue } from '../../../internals/types';
import { TUpdateOp } from '../../../internals/object/types';
import { RelationOptions } from '../../../server/storage';

export interface SqlDialect {
  quote(str: string): string;
  identifier(name: string): string;
  placeholder(idx: number): string;
  boolean(value: boolean): string;
  encodeType(colname: string, type: TSchema.DataType, value: TValue): SQL;
  decodeType(type: TSchema.Primitive | 'vector', value: any): TValue;
  updateOperation(paths: string[], dataType: TSchema.DataType, operation: TUpdateOp): SQL;

  selectPopulate(
    compiler: QueryCompiler,
    parent: { className: string; name: string; },
    populate: Populate,
    field: string,
    countMatches: boolean,
  ): { columns: SQL[], join?: SQL }

  encodeFieldExpression(
    compiler: QueryCompiler,
    parent: { className?: string; name: string; populates?: Record<string, Populate>; },
    field: string,
    expr: FieldSelectorExpression,
  ): SQL

  encodeQueryExpression(
    compiler: QueryCompiler,
    parent: { className?: string; name: string; },
    expr: QueryExpression,
  ): SQL | undefined

  encodePopulate(
    compiler: QueryCompiler,
    parent: Populate,
    remix?: { className: string; name: string; }
  ): Record<string, SQL>

  encodeRelation(
    compiler: QueryCompiler,
    parent: { className: string; name: string; },
    relatedBy: NonNullable<RelationOptions['relatedBy']>
  ): SQL

  encodeSortKey(
    compiler: QueryCompiler,
    parent: { className?: string; name: string; },
    key: string
  ): SQL

  random(opts: { weight?: string }): SQL
}
