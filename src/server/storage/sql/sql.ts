//
//  sql.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { SqlDialect } from './dialect';
import { TValue } from '../../../internals/types';

type SQLLiteral = SQL | SQL[] | { literal: string | SQL[], separator?: string };
type SQLIdentifier = { identifier: string };
type SQLEscapeString = { quote: string };
type SQLValue = { value: TValue } | SQLIdentifier | SQLLiteral | SQLEscapeString;

const isSQLArray = (v: any): v is SQL[] => _.isArray(v) && _.every(v, x => x instanceof SQL);

export class SQL {

  strings: TemplateStringsArray;
  values: SQLValue[];

  constructor(templates: TemplateStringsArray, values: SQLValue[]) {
    this.strings = templates;
    this.values = values;
  }

  private _compile(dialect: SqlDialect, nextIdx: () => number) {
    let [query, ...strings] = this.strings;
    const values: any[] = [];
    for (const [value, str] of _.zip(this.values, strings)) {
      if (_.isNil(value)) break;
      if (value instanceof SQL) {
        const { query: _query, values: _values } = value._compile(dialect, nextIdx);
        query += _query;
        values.push(..._values);
      } else if (isSQLArray(value)) {
        const queries: string[] = [];
        for (const subquery of value) {
          const { query: _query, values: _values } = subquery._compile(dialect, nextIdx);
          queries.push(_query);
          values.push(..._values);
        }
        query += queries.join(', ');
      } else if ('quote' in value) {
        query += dialect.quote(value.quote);
      } else if ('identifier' in value) {
        query += dialect.identifier(value.identifier);
      } else if ('literal' in value) {
        if (_.isString(value.literal)) {
          query += value.literal;
        } else {
          const queries: string[] = [];
          for (const subquery of value.literal) {
            const { query: _query, values: _values } = subquery._compile(dialect, nextIdx);
            queries.push(_query);
            values.push(..._values);
          }
          query += queries.join(value.separator ?? ', ');
        }
      } else if (_.isBoolean(value.value)) {
        query += dialect.boolean(value.value);
      } else if (_.isString(value.value)) {
        query += `${dialect.quote(value.value)}::TEXT`;
      } else if (_.isSafeInteger(value.value)) {
        query += `${value.value}`;
      } else if (_.isNumber(value.value)) {
        query += `${dialect.placeholder(nextIdx())}::DOUBLE PRECISION`;
        values.push(value.value);
      } else {
        query += dialect.placeholder(nextIdx());
        values.push(value.value);
      }
      query += str;
    }
    return { query: _.compact(query.split('\n').filter(x => !x.match(/^\s+$/g))).join('\n'), values };
  }

  compile(dialect: SqlDialect) {
    let idx = 1;
    return this._compile(dialect, () => idx++);
  }
}

export const sql = (templates: TemplateStringsArray, ...values: SQLValue[]) => new SQL(templates, values);
