//
//  storage.ts
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
import { DecodedQuery, FindOptions, InsertOptions, TStorage, RelationOptions, DecodedBaseQuery } from '../../../server/storage';
import { TransactionOptions } from '../../../internals/proto';
import { TSchema, isPointer, isRelation, isShape, shapePaths } from '../../../internals/schema';
import { SQL, sql } from './sql';
import { SqlDialect } from './dialect';
import { QueryCompiler } from './compiler';
import { asyncStream } from '@o2ter/utils-js';
import { TValue, TValueWithoutObject, TValueWithUndefined } from '../../../internals/types';
import { TObject } from '../../../internals/object';
import { PVK } from '../../../internals/private';
import { TQueryRandomOptions } from '../../../internals/query';
import { TUpdateOp } from '../../../internals/object/types';
import { QuerySelector } from '../../../server/query/dispatcher/parser';
import { QueryAccumulator } from '../../../server/query/dispatcher/parser/accumulators';

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

  abstract config(acl?: string[]): PromiseLike<Record<string, TValueWithoutObject>>;
  abstract configAcl(): PromiseLike<Record<string, string[]>>;
  abstract setConfig(values: Record<string, TValueWithoutObject>, acl?: string[]): PromiseLike<void>;
  abstract lockTable(className: string | string[], update: boolean): Promise<void>;
  abstract withConnection<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>;
  abstract isDuplicateIdError(error: any): boolean;
  abstract atomic<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: { lockTable?: string; retry?: boolean; },
  ): PromiseLike<T>;
  abstract withTransaction<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: TransactionOptions,
  ): PromiseLike<T>;

  abstract get dialect(): SqlDialect;
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>;

  abstract _refs(schema: Record<string, TSchema>, className: string, keys: string[], item: SQL): SQL;

  query(sql: SQL) {
    const { query, values } = sql.compile(this.dialect);
    return this._query(query, values);
  }

  abstract _explain(compiler: QueryCompiler, query: DecodedQuery<FindOptions & RelationOptions>): PromiseLike<any>

  private _decodeMatchTypes(value: any, matchType: Record<string, any>): any {
    if (!_.isPlainObject(value)) return;
    return _.mapValues(value, (v, k) => this.dialect.decodeType(matchType[k], v));
  }

  private _decodeShapedObject(dataType: TSchema.ShapeType, value: any, matchesType: Record<string, any>) {
    const result = {};
    for (const { path, type } of shapePaths(dataType)) {
      const matchType = _.get(matchesType, path) ?? {};
      if (_.isString(type)) {
        const _value = this.dialect.decodeType(type, _.get(value, path));
        if (!_.isNil(_value)) _.set(result, path, _value);
      } else if (isPointer(type)) {
        const _value = _.get(value, path);
        if (_.isPlainObject(_value)) {
          const decoded = this._decodeObject(type.target, _value, matchType);
          if (decoded.objectId) _.set(result, path, decoded);
        }
      } else if (isRelation(type)) {
        const _value = _.get(value, path);
        if (_.isArray(_value)) _.set(result, path, _value.map(x => this._decodeObject(type.target, x, matchType)));
        else if (_.isPlainObject(_value)) _.set(result, path, this._decodeMatchTypes(_value, matchType));
      } else {
        const _value = this.dialect.decodeType(type.type, _.get(value, path)) ?? type.default;
        if (!_.isNil(_value)) _.set(result, path, _value);
      }
    }
    return result;
  }

  protected _decodeObject(className: string, attrs: Record<string, any>, matchesType: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    const _attrs: Record<string, any> = {};
    for (const [key, value] of _.toPairs(attrs)) {
      _.set(_attrs, key, value);
    }
    for (const [key, value] of _.toPairs(_attrs)) {
      const matchType = matchesType[key] ?? {};
      const dataType = fields[key];
      if (!dataType) continue;
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType, value);
      } else if (isShape(dataType)) {
        obj[PVK].attributes[key] = this._decodeShapedObject(dataType, value, matchType);
      } else if (isPointer(dataType)) {
        if (_.isPlainObject(value)) {
          const decoded = this._decodeObject(dataType.target, value, matchType);
          if (decoded.objectId) obj[PVK].attributes[key] = decoded;
        }
      } else if (isRelation(dataType)) {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x, matchType));
        else if (_.isPlainObject(value)) obj[PVK].attributes[key] = this._decodeMatchTypes(value, matchType);
      } else {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType.type, value) ?? dataType.default as any;
      }
    }
    return obj;
  }

  private _makeCompiler(
    isUpdate: boolean,
    extraFilter?: (className: string) => QuerySelector,
  ) {
    return new QueryCompiler({
      schema: this.schema,
      dialect: this.dialect,
      selectLock: this.selectLock(),
      isUpdate,
      extraFilter,
    });
  }

  async explain(query: DecodedQuery<FindOptions & RelationOptions>) {
    const compiler = this._makeCompiler(false, query.extraFilter);
    return this._explain(compiler, query);
  }

  async count(query: DecodedQuery<FindOptions & RelationOptions>) {
    const compiler = this._makeCompiler(false, query.extraFilter);
    const [{ count: _count }] = await this.query(compiler._selectQuery(query, {
      select: sql`COUNT(*) AS count`,
    }));
    const count = parseInt(_count);
    return _.isFinite(count) ? count : 0;
  }

  private _matchesType(compiler: QueryCompiler, options: {
      matches: Record<string, DecodedBaseQuery>;
      groupMatches?: Record<string, Record<string, QueryAccumulator>>;
  }): Record<string, any> {
    const types: Record<string, any> = {};
    for (const [key, match] of _.entries(options.matches)) {
      types[key] = this._matchesType(compiler, match);
    }
    for (const [key, group] of _.entries(options.groupMatches)) {
      for (const [field, expr] of _.entries(group)) {
        _.set(types, `${key}.${field}`, expr.calculatedDataType);
      }
    }
    return types;
  }

  find(query: DecodedQuery<FindOptions & RelationOptions>) {
    const self = this;
    const compiler = self._makeCompiler(false, query.extraFilter);
    const _matchesType = self._matchesType(compiler, query);
    const _query = compiler._selectQuery(query);
    return (async function* () {
      const objects = self.query(_query);
      for await (const object of objects) {
        yield self._decodeObject(query.className, object, _matchesType);
      }
    })();
  }

  random(query: DecodedQuery<FindOptions & RelationOptions>, opts?: TQueryRandomOptions) {
    const self = this;
    const compiler = self._makeCompiler(false, query.extraFilter);
    const _matchesType = self._matchesType(compiler, query);
    const _query = compiler._selectQuery({ ...query, sort: {} }, {
      sort: sql`ORDER BY ${self.dialect.random(opts ?? {})}`,
    });
    return (async function* () {
      const objects = self.query(_query);
      for await (const object of objects) {
        yield self._decodeObject(query.className, object, self._matchesType(compiler, query));
      }
    })();
  }

  refs(object: TObject, classNames: string[], roles?: string[]) {
    const self = this;
    const query = sql`
      SELECT *
      FROM (${this._refs(
      _.pick(this.schema, classNames), object.className, TObject.defaultKeys,
      sql`${{ value: `${object.className}$${object.objectId}` }}`,
    )}) AS "$"
      ${_.isNil(roles) ? sql`` : sql`WHERE ${{ identifier: '$' }}.${{ identifier: '_rperm' }} && ${{ value: roles }}`}
    `;
    return (async function* () {
      const objects = self.query(query);
      for await (const { _class, ...object } of objects) {
        yield self._decodeObject(_class, object, {});
      }
    })();
  }

  nonrefs(query: DecodedQuery<FindOptions>) {
    const self = this;
    const compiler = self._makeCompiler(false, query.extraFilter);
    const _matchesType = self._matchesType(compiler, query);
    const _query = compiler._selectQuery(query, ({ fetchName }) => ({
      extraFilter: sql`
        NOT EXISTS (${this._refs(
        this.schema, query.className, ['_id'],
        sql`(${{ quote: query.className + '$' }} || ${{ identifier: fetchName }}.${{ identifier: '_id' }})`,
      )})
      `
    }));
    return (async function* () {
      const objects = self.query(_query);
      for await (const object of objects) {
        yield self._decodeObject(query.className, object, _matchesType);
      }
    })();
  }

  async insert(options: InsertOptions, values: Record<string, TValueWithUndefined>[]) {
    const compiler = this._makeCompiler(true);
    const _matchesType = this._matchesType(compiler, options);
    const result = await this.query(compiler.insert(options, values));
    return _.map(result, x => this._decodeObject(options.className, x, _matchesType));
  }

  async update(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>) {
    const compiler = this._makeCompiler(true, query.extraFilter);
    const _matchesType = this._matchesType(compiler, query);
    const updated = await this.query(compiler.update(query, update));
    return _.map(updated, x => this._decodeObject(query.className, x, _matchesType));
  }

  async upsert(query: DecodedQuery<FindOptions>, update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValueWithUndefined>) {
    const compiler = this._makeCompiler(true, query.extraFilter);
    const _matchesType = this._matchesType(compiler, query);
    const upserted = await this.query(compiler.upsert(query, update, setOnInsert));
    return _.map(upserted, x => this._decodeObject(query.className, x, _matchesType));
  }

  async delete(query: DecodedQuery<FindOptions>) {
    const compiler = this._makeCompiler(true, query.extraFilter);
    const _matchesType = this._matchesType(compiler, query);
    const deleted = await this.query(compiler.delete(query));
    return _.map(deleted, x => this._decodeObject(query.className, x, _matchesType));
  }
}
