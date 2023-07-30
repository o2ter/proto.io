//
//  storage.ts
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

import _ from 'lodash';
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions, TStorage } from '../storage';
import { TSchema } from '../schema';
import { storageSchedule } from '../schedule';
import { TValue, UpdateOp, asyncStream, isPrimitiveValue } from '../../internals';
import { SQL } from './sql';
import { SqlDialect } from './dialect';
import { QueryCompiler, QueryCompilerOptions } from './compiler';

const isSQLArray = (v: any): v is SQL[] => _.isArray(v) && _.every(v, x => x instanceof SQL);
export abstract class SqlStorage implements TStorage {

  schedule = storageSchedule(this, ['expireDocument']);
  schema: Record<string, TSchema> = {};

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
    this.schedule?.execute();
  }

  async shutdown() {
    this.schedule?.destory();
  }

  classes() {
    return Object.keys(this.schema);
  }

  abstract get dialect(): SqlDialect
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>

  private _compile(template: SQL, nextIdx: () => number) {
    let [query, ...strings] = template.strings;
    const values: any[] = [];
    for (const [value, str] of _.zip(template.values, strings)) {
      if (_.isNil(value)) break;
      if (value instanceof SQL) {
        const { query: _query, values: _values } = this._compile(value, nextIdx);
        query += `${_query}${str}`;
        values.push(..._values);
      } else {
        if (_.isBoolean(value)) {
          query += `${this.dialect.boolean(value)}${str}`;
        } else if (isSQLArray(value)) {
          const queries: string[] = [];
          for (const subquery of value) {
            const { query: _query, values: _values } = this._compile(subquery, nextIdx);
            queries.push(_query);
            values.push(..._values);
          }
          query += `${queries.join(', ')}${str}`;
        } else if (!isPrimitiveValue(value)) {
          if ('identifier' in value && _.isString(value.identifier)) {
            query += `${this.dialect.identifier(value.identifier)}${str}`;
          } else if ('literal' in value && _.isString(value.literal)) {
            query += `${value.literal}${str}`;
          } else if ('literal' in value && _.isArray(value.literal)) {
            const queries: string[] = [];
            for (const subquery of value.literal) {
              const { query: _query, values: _values } = this._compile(subquery, nextIdx);
              queries.push(_query);
              values.push(..._values);
            }
            query += `${queries.join(value.separator ?? ', ')}${str}`;
          } else {
            query += `${this.dialect.placeholder(nextIdx())}${str}`;
            values.push(value);
          }
        } else {
          query += `${this.dialect.placeholder(nextIdx())}${str}`;
          values.push(value);
        }
      }
    }
    return { query, values };
  }

  query(sql: SQL) {
    const { query, values } = this.compile(sql);
    return this._query(query, values);
  }

  compile(template: SQL) {
    let idx = 1;
    return this._compile(template, () => idx++);
  }

  _queryCompiler(query: QueryCompilerOptions) {
    const compiler = new QueryCompiler(this.schema, query, this.dialect);
    compiler.compile();
    return compiler;
  }

  async explain(query: DecodedQuery<ExplainOptions>) {
    return 0;
  }

  async count(query: DecodedQuery<FindOptions>) {
    return 0;
  }

  async* find(query: DecodedQuery<FindOptions>) {
    return [];
  }

  async insert(className: string, attrs: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpdate(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    return undefined;
  }

  async findOneAndReplace(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndUpsert(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return undefined;
  }

  async findOneAndDelete(query: DecodedQuery<FindOneOptions>) {
    return undefined;
  }

  async findAndDelete(query: DecodedQuery<FindOptions>) {
    return 0;
  }

}