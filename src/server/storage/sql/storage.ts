//
//  storage.ts
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
import { DecodedQuery, FindOptions, FindOneOptions, InsertOptions, TStorage } from '..';
import { TransactionOptions } from '../../../internals/proto';
import { TSchema, isPointer, isRelation, isShapedObject, shapedObjectPaths } from '../../../internals/schema';
import { SQL, sql } from './sql';
import { SqlDialect } from './dialect';
import { QueryCompiler } from './compiler';
import { asyncStream } from '@o2ter/utils-js';
import { TValue, _TValue } from '../../../internals/types';
import { TObject } from '../../../internals/object';
import { PVK } from '../../../internals/private';
import { TQueryRandomOptions } from '../../../internals/query';
import { TUpdateOp } from '../../../internals/object/types';
import { QuerySelector } from '../../query/dispatcher/parser';

export abstract class SqlStorage implements TStorage {

  schema: Record<string, TSchema> = {};

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
  }

  async shutdown() { }

  classes() {
    return Object.keys(this.schema);
  }

  abstract selectLock(): boolean;

  abstract config(acl?: string[]): PromiseLike<Record<string, _TValue>>;
  abstract configAcl(): PromiseLike<Record<string, string[]>>;
  abstract setConfig(values: Record<string, _TValue>, acl?: string[]): PromiseLike<void>;
  abstract lockTable(className: string | string[], update: boolean): Promise<void>;
  abstract withConnection<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>;
  abstract atomic<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>;
  abstract withTransaction<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: TransactionOptions,
  ): PromiseLike<T>;

  abstract get dialect(): SqlDialect;
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>;

  abstract refs(object: TObject, classNames: string[], roles?: string[]): AsyncIterable<TObject>;
  abstract nonrefs(className: string, roles?: string[]): AsyncIterable<TObject>;

  query(sql: SQL) {
    const { query, values } = sql.compile(this.dialect);
    return this._query(query, values);
  }

  abstract _explain(compiler: QueryCompiler, query: DecodedQuery<FindOptions>): PromiseLike<any>

  private _decodeShapedObject(dataType: TSchema.ShapedObject, value: any) {
    const result = {};
    for (const { path, type } of shapedObjectPaths(dataType)) {
      if (_.isString(type)) {
        const _value = this.dialect.decodeType(type, _.get(value, path));
        if (!_.isNil(_value)) _.set(result, path, _value);
      } else if (isPointer(type)) {
        const _value = _.get(value, path);
        if (_.isPlainObject(_value)) {
          const decoded = this._decodeObject(type.target, _value);
          if (decoded.objectId) _.set(result, path, decoded);
        }
      } else if (isRelation(type)) {
        const _value = _.get(value, path);
        if (_.isArray(_value)) _.set(result, path, _value.map(x => this._decodeObject(type.target, x)));
      } else {
        const _value = this.dialect.decodeType(type.type, _.get(value, path)) ?? type.default;
        if (!_.isNil(_value)) _.set(result, path, _value);
      }
    }
    return result;
  }

  protected _decodeObject(className: string, attrs: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    const _attrs: Record<string, any> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      _.set(_attrs, key, value);
    }
    for (const [key, value] of _.toPairs(_attrs)) {
      const dataType = fields[key];
      if (!dataType) continue;
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType, value);
      } else if (isShapedObject(dataType)) {
        obj[PVK].attributes[key] = this._decodeShapedObject(dataType, value);
      } else if (isPointer(dataType)) {
        if (_.isPlainObject(value)) {
          const decoded = this._decodeObject(dataType.target, value);
          if (decoded.objectId) obj[PVK].attributes[key] = decoded;
        }
      } else if (isRelation(dataType)) {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x));
      } else {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType.type, value) ?? dataType.default as any;
      }
    }
    return obj;
  }

  async explain(query: DecodedQuery<FindOptions>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), false);
    return this._explain(compiler, query);
  }

  async count(query: DecodedQuery<FindOptions>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), false);
    const [{ count: _count }] = await this.query(compiler._selectQuery(query, {
      select: sql`COUNT(*) AS count`,
    }));
    const count = parseInt(_count);
    return _.isFinite(count) ? count : 0;
  }

  find(query: DecodedQuery<FindOptions>) {
    const self = this;
    const compiler = new QueryCompiler(self.schema, self.dialect, self.selectLock(), false);
    const _query = compiler._selectQuery(query);
    return (async function* () {
      const objects = self.query(_query);
      for await (const object of objects) {
        yield self._decodeObject(query.className, object);
      }
    })();
  }

  random(query: DecodedQuery<FindOptions>, opts?: TQueryRandomOptions) {
    const self = this;
    const compiler = new QueryCompiler(self.schema, self.dialect, self.selectLock(), false);
    const _query = compiler._selectQuery({ ...query, sort: {} }, {
      sort: sql`ORDER BY ${self.dialect.random(opts ?? {})}`,
    });
    return (async function* () {
      const objects = self.query(_query);
      for await (const object of objects) {
        yield self._decodeObject(query.className, object);
      }
    })();
  }

  async insert(options: InsertOptions, attrs: Record<string, TValue>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), true);
    const result = _.first(await this.query(compiler.insert(options, attrs)));
    return _.isNil(result) ? undefined : this._decodeObject(options.className, result);
  }

  async updateOne(query: DecodedQuery<FindOneOptions>, update: Record<string, TUpdateOp>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), true);
    const updated = _.first(await this.query(compiler.updateOne(query, update)));
    return _.isNil(updated) ? undefined : this._decodeObject(query.className, updated);
  }

  async upsertOne(query: DecodedQuery<FindOneOptions>, update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValue>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), true);
    const upserted = _.first(await this.query(compiler.upsertOne(query, update, setOnInsert)));
    return _.isNil(upserted) ? undefined : this._decodeObject(query.className, upserted);
  }

  async deleteOne(query: DecodedQuery<FindOneOptions>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), true);
    const deleted = _.first(await this.query(compiler.deleteOne(query)));
    return _.isNil(deleted) ? undefined : this._decodeObject(query.className, deleted);
  }

  async deleteMany(query: DecodedQuery<FindOptions>) {
    const compiler = new QueryCompiler(this.schema, this.dialect, this.selectLock(), true);
    const deleted = await this.query(compiler.deleteMany(query));
    return deleted.length;
  }

}
