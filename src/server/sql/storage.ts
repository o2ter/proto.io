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
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions, InsertOptions, TStorage } from '../storage';
import { TSchema, defaultObjectKeyTypes } from '../schema';
import { storageSchedule } from '../schedule';
import { PVK, TObject, TValue, UpdateOp, asyncStream, isPrimitiveValue } from '../../internals';
import { SQL, sql } from './sql';
import { SqlDialect } from './dialect';
import { QueryCompiler, QueryCompilerOptions } from './compiler';
import { generateId } from '../crypto';

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
  protected abstract _encodeData(type: TSchema.Primitive, value: TValue): any
  protected abstract _decodeData(type: TSchema.Primitive, value: any): TValue

  private _compile(template: SQL, nextIdx: () => number) {
    let [query, ...strings] = template.strings;
    const values: any[] = [];
    for (const [value, str] of _.zip(template.values, strings)) {
      if (_.isNil(value)) break;
      if (value instanceof SQL) {
        const { query: _query, values: _values } = this._compile(value, nextIdx);
        query += _query;
        values.push(..._values);
      } else if (_.isBoolean(value)) {
        query += this.dialect.boolean(value);
      } else if (isSQLArray(value)) {
        const queries: string[] = [];
        for (const subquery of value) {
          const { query: _query, values: _values } = this._compile(subquery, nextIdx);
          queries.push(_query);
          values.push(..._values);
        }
        query += queries.join(', ');
      } else if ('quote' in value) {
        query += this.dialect.quote(value.quote);
      } else if ('identifier' in value) {
        query += this.dialect.identifier(value.identifier);
      } else if ('literal' in value) {
        if (_.isString(value.literal)) {
          query += value.literal;
        } else {
          const queries: string[] = [];
          for (const subquery of value.literal) {
            const { query: _query, values: _values } = this._compile(subquery, nextIdx);
            queries.push(_query);
            values.push(..._values);
          }
          query += queries.join(value.separator ?? ', ');
        }
      } else {
        query += this.dialect.placeholder(nextIdx());
        values.push('value' in value ? value.value : value);
      }
      query += str;
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

  private _encodeObjectAttrs(className: string, attrs: Record<string, TValue>): Record<string, any> {
    const fields = this.schema[className].fields;
    const result: Record<string, any> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      if (_.isString(dataType)) {
        result[key] = this._encodeData(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        result[key] = this._encodeData(dataType.type, value);
      } else if (dataType.type === 'pointer') {
        if (value instanceof TObject && value.objectId) result[key] = `${value.className}$${value.objectId}`;
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) result[key] = _.uniq(_.compact(value.map(x => x instanceof TObject && x.objectId ? `${x.className}$${x.objectId}` : undefined)));
      }
    }
    return result;
  }

  private _decodeObject(className: string, attrs: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key] ?? defaultObjectKeyTypes[key];
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this._decodeData(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        obj[PVK].attributes[key] = this._decodeData(dataType.type, value);
      } else if (dataType.type === 'pointer') {
        if (_.isPlainObject(value)) obj[PVK].attributes[key] = this._decodeObject(dataType.target, value);
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x));
      }
    }
    return obj;
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

  async insert(options: InsertOptions, attrs: Record<string, TValue>) {

    const _attrs: [string, TValue][] = _.toPairs({
      _id: generateId(options.objectIdSize),
      ...this._encodeObjectAttrs(options.className, attrs),
    });

    const compiler = this._queryCompiler({
      className: options.className,
      includes: options.includes,
    });

    const tempName = `_temp_${options.className.toLowerCase()}`;

    const result = _.first(await this.query(sql`
      WITH ${{ identifier: tempName }} AS (
        INSERT INTO ${{ identifier: options.className }}
        (${_.map(_attrs, x => sql`${{ identifier: x[0] }}`)})
        VALUES (${_.map(_attrs, x => sql`${{ value: x[1] }}`)})
        RETURNING *
      )
      SELECT * FROM ${{ identifier: tempName }};
    `));

    console.log(compiler)

    return _.isNil(result) ? undefined : this._decodeObject(options.className, result);
  }

  async updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>) {
    return undefined;
  }

  async replaceOne(query: DecodedQuery<FindOneOptions>, replacement: Record<string, TValue>) {
    return undefined;
  }

  async upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return undefined;
  }

  async deleteOne(query: DecodedQuery<FindOneOptions>) {
    return undefined;
  }

  async deleteMany(query: DecodedQuery<FindOptions>) {
    return 0;
  }

}