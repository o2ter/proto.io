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
import { DecodedQuery, FindOptions, FindOneOptions, InsertOptions, TStorage, TransactionOptions } from '../storage';
import { TSchema } from '../../internals/schema';
import { ScheduleOp, storageSchedule } from '../schedule';
import { PVK, TObject, TValue, TUpdateOp, asyncStream, _TValue } from '../../internals';
import { SQL, sql } from './sql';
import { SqlDialect } from './dialect';
import { QueryCompiler } from './compiler';

export abstract class SqlStorage implements TStorage {

  schedule: ReturnType<typeof storageSchedule>;
  schema: Record<string, TSchema> = {};

  constructor(schedule?: ScheduleOp[]) {
    this.schedule = storageSchedule(this, schedule ?? ['expireDocument']);
  }

  async prepare(schema: Record<string, TSchema>) {
    this.schema = schema;
  }

  async shutdown() {
    this.schedule.destory();
  }

  classes() {
    return Object.keys(this.schema);
  }

  abstract selectLock(): boolean;

  abstract config(): PromiseLike<Record<string, _TValue>>;
  abstract setConfig(values: Record<string, _TValue>): PromiseLike<void>;
  abstract withConnection<T>(callback: (connection: TStorage) => PromiseLike<T>): PromiseLike<T>
  abstract withTransaction<T>(
    callback: (connection: TStorage) => PromiseLike<T>,
    options?: TransactionOptions,
  ): PromiseLike<T>

  abstract get dialect(): SqlDialect
  protected abstract _query(text: string, values: any[]): ReturnType<typeof asyncStream<any>>

  query(sql: SQL) {
    const { query, values } = sql.compile(this.dialect);
    return this._query(query, values);
  }

  abstract _explain(compiler: QueryCompiler, query: DecodedQuery<FindOptions>): PromiseLike<any>

  private _decodeObject(className: string, attrs: Record<string, any>): TObject {
    const fields = this.schema[className].fields;
    const obj = new TObject(className);
    for (const [key, value] of _.toPairs(attrs)) {
      const dataType = fields[key];
      if (_.isString(dataType)) {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType, value);
      } else if (dataType.type !== 'pointer' && dataType.type !== 'relation') {
        obj[PVK].attributes[key] = this.dialect.decodeType(dataType.type, value) ?? dataType.default as any;
      } else if (dataType.type === 'pointer') {
        if (_.isPlainObject(value)) obj[PVK].attributes[key] = this._decodeObject(dataType.target, value);
      } else if (dataType.type === 'relation') {
        if (_.isArray(value)) obj[PVK].attributes[key] = value.map(x => this._decodeObject(dataType.target, x));
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
    const result = await this.query(compiler._selectQuery(query, sql`COUNT(*) AS count`));
    const count = parseInt(_.first(result).count);
    return _.isFinite(count) ? count : 0;
  }

  find(query: DecodedQuery<FindOptions>) {
    const self = this;
    return asyncStream(async function* () {
      const compiler = new QueryCompiler(self.schema, self.dialect, self.selectLock(), false);
      const objects = self.query(compiler._selectQuery(query));
      for await (const object of objects) {
        yield self._decodeObject(query.className, object);
      }
    });
  }

  random(query: DecodedQuery<FindOptions>, weight?: string) {
    const self = this;
    // -LOG(RAND()) / weight
    return asyncStream(async function* () {
      const compiler = new QueryCompiler(self.schema, self.dialect, self.selectLock(), false);
      const objects = self.query(compiler._selectQuery(query));
      for await (const object of objects) {
        yield self._decodeObject(query.className, object);
      }
    });
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
