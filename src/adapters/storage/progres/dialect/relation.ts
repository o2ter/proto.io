//
//  relation.ts
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
import { QueryCompiler, QueryContext } from '../../sql/compiler';
import { RelationOptions } from '../../../../server/storage';
import { sql, SQL } from '../../sql';
import { encodeForeignField } from './populate';

export const encodeRelation = (
  compiler: QueryCompiler,
  parent: QueryContext & { className: string; },
  relatedBy: NonNullable<RelationOptions['relatedBy']>
): SQL => {
  const name = `_relation_$${relatedBy.className.toLowerCase()}`;
  const _local = (field: string) => sql`${{ identifier: parent.name }}.${{ identifier: field }}`;
  const _foreign = (field: string) => sql`${{ identifier: name }}.${{ identifier: field }}`;
  const { joins, field } = encodeForeignField(compiler, { className: relatedBy.className, name }, relatedBy.key);
  return sql`EXISTS (
    SELECT 1
    FROM ${{ identifier: relatedBy.className }} AS ${{ identifier: name }}
    ${!_.isEmpty(joins) ? { literal: joins, separator: '\n' } : sql``}
    WHERE ${_foreign('_id')} = ${{ value: relatedBy.id }} AND ${sql`(${{ quote: parent.className + '$' }} || ${_local('_id')})`} = ANY(${field})
  )`;
}