//
//  methods.ts
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
import { _serviceOf, ProtoService } from '../proto';
import { dispatcher } from './dispatcher';
import { asyncStream } from '@o2ter/utils-js';
import { PVK } from '../../internals/private';
import { ExtraOptions } from '../../internals/options';
import { TQuery, TQueryOptions, TQueryRandomOptions } from '../../internals/query';
import { TObject } from '../../internals/object';
import { TExtended } from '../../internals/object/methods';
import { TValueWithUndefined } from '../../internals/types';
import { TUpdateOp } from '../../internals/object/types';
import { resolveColumn } from './dispatcher/validator';
import { isPointer, isRelation } from '../../internals/schema';
import { proxy } from '../proto/proxy';
import { LiveQuerySubscription } from '../../internals/liveQuery';
import { ProtoType } from '../../internals/proto';
import { TAccumulatorResult, TQueryAccumulator } from '../../internals/query/types/accumulators';

type _QueryOptions = {
  insecure?: boolean;
  createFile?: boolean;
  relatedBy?: {
    className: string;
    id: string;
    key: string;
  };
};

export const afterCommitTasks = new WeakMap<ProtoType<any>, (() => void)[]>();

abstract class _ProtoQuery<T extends string, E, M extends boolean> extends TQuery<T, E, M> {

  protected _proto: ProtoService<E>;
  protected _opts: _QueryOptions;

  constructor(proto: ProtoService<E>, opts: _QueryOptions) {
    super();
    this._proto = proto;
    this._opts = opts;
  }

  abstract get className(): T;

  private get _queryOptions() {
    return {
      ...this[PVK].options,
      className: this.className,
      relatedBy: this._opts.relatedBy,
    };
  }

  private _dispatcher(
    options?: ExtraOptions<M>
  ): ReturnType<typeof dispatcher<E>> {
    const schema = this._proto.schema[this.className];
    if (_.isNil(schema)) throw Error('Invalid className');
    if (this._opts.insecure) {
      if (options?.master !== true) throw Error('No permission');
    }
    return dispatcher(_serviceOf(options) ?? this._proto, {
      ...options ?? {},
      disableSecurity: !!this._opts.insecure,
      createFile: !!this._opts.createFile,
    });
  }

  explain(options?: ExtraOptions<M>) {
    return this._dispatcher(options).explain(this._queryOptions);
  }

  count(options?: ExtraOptions<M>) {
    return this._dispatcher(options).count(this._queryOptions);
  }

  private _objectMethods<U extends TObject | TObject[] | undefined>(object: U) {
    return this._proto.rebind(object) as TExtended<U, T, E>;
  }

  find(options?: ExtraOptions<M>) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).find(self._queryOptions);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  groupFind<T extends Record<string, TQueryAccumulator>>(
    accumulators: T,
    options?: ExtraOptions<M> | undefined
  ): Promise<{ [K in keyof T]: TAccumulatorResult<T[K]>; }> {
    return this._dispatcher(options).groupFind(this._queryOptions, accumulators) as any;
  }

  nonrefs(options?: ExtraOptions<M>) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).nonrefs(self._queryOptions);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  random(
    opts?: TQueryRandomOptions,
    options?: ExtraOptions<M>
  ) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).random(self._queryOptions, opts);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  private _on_upsert_traggers(objects: TObject[]) {
    const createTraggers = this._proto[PVK].triggers[this.className]?.create ?? [];
    const updateTraggers = this._proto[PVK].triggers[this.className]?.update ?? [];
    for (const obj of objects) {
      for (const tragger of obj.__v === 0 ? createTraggers : updateTraggers) {
        (async () => {
          try {
            await tragger(proxy(Object.setPrototypeOf({ object: obj }, this._proto)));
          } catch (e) {
            this._proto.logger.error(e);
          }
        })();
      }
    }
  }

  private _on_upsert(objects: TObject[]) {
    if (this._proto.schema[this.className]?.liveQuery) {
      (async () => {
        try {
          await this._proto[PVK].publishLiveQuery(this._proto, 'create', _.filter(objects, x => x.__v === 0));
          await this._proto[PVK].publishLiveQuery(this._proto, 'update', _.filter(objects, x => x.__v !== 0));
        } catch (e) {
          this._proto.logger.error(e);
        }
      })();
    }
  }

  private _on_delete_traggers(objects: TObject[]) {
    const traggers = this._proto[PVK].triggers[this.className]?.delete ?? [];
    for (const obj of objects) {
      for (const tragger of traggers) {
        (async () => {
          try {
            await tragger(proxy(Object.setPrototypeOf({ object: obj }, this._proto)));
          } catch (e) {
            this._proto.logger.error(e);
          }
        })();
      }
    }
  }

  private _on_delete(objects: TObject[]) {
    if (this._proto.schema[this.className]?.liveQuery) {
      (async () => {
        try {
          await this._proto[PVK].publishLiveQuery(this._proto, 'delete', objects);
        } catch (e) {
          this._proto.logger.error(e);
        }
      })();
    }
  }

  private _do_tasks(session: ProtoType<any> | undefined, task: () => void) {
    const registers = session && afterCommitTasks.get(session);
    if (!_.isNil(registers)) {
      registers.push(task);
    } else {
      task();
    }
  }

  async insertMany(
    values: Record<string, TValueWithUndefined>[],
    options?: ExtraOptions<M>
  ) {
    const objs = this._objectMethods(
      await this._dispatcher(options).insert({
        className: this.className,
        includes: this[PVK].options.includes,
        matches: this[PVK].options.matches,
        groupMatches: this[PVK].options.groupMatches,
      }, values)
    );
    this._do_tasks(options?.session, () => {
      this._on_upsert(objs);
      if (!options?.silent || !options.master) this._on_upsert_traggers(objs);
    });
    return objs;
  }

  async updateMany(
    update: Record<string, TUpdateOp>,
    options?: ExtraOptions<M>
  ) {
    const objs = this._objectMethods(
      await this._dispatcher(options).update(this._queryOptions, update)
    );
    this._do_tasks(options?.session, () => {
      this._on_upsert(objs);
      if (!options?.silent || !options.master) this._on_upsert_traggers(objs);
    });
    return objs;
  }

  async upsertMany(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValueWithUndefined>,
    options?: ExtraOptions<M>
  ) {
    const objs = this._objectMethods(
      await this._dispatcher(options).upsert(this._queryOptions, update, setOnInsert)
    );
    this._do_tasks(options?.session, () => {
      this._on_upsert(objs);
      if (!options?.silent || !options.master) this._on_upsert_traggers(objs);
    });
    return objs;
  }

  async deleteMany(options?: ExtraOptions<M>) {
    const objs = this._objectMethods(
      await this._dispatcher(options).delete(this._queryOptions)
    );
    this._do_tasks(options?.session, () => {
      this._on_delete(objs);
      if (!options?.silent || !options.master) this._on_delete_traggers(objs);
    });
    return objs;
  }
}

export class ProtoQuery<T extends string, E, M extends boolean> extends _ProtoQuery<T, E, M> {

  private _className: T;

  constructor(className: T, proto: ProtoService<E>, opts: _QueryOptions) {
    super(proto, opts);
    this._className = className;
  }

  get className(): T {
    return this._className;
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoQuery(this.className, this._proto, this._opts);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  subscribe() {
    return new LiveQuerySubscription<T, E>(
      this.className,
      this._proto,
      this[PVK].options.filter ?? [],
    );
  }
}

export class ProtoRelationQuery<E, M extends boolean> extends _ProtoQuery<string, E, M> {

  constructor(proto: ProtoService<E>, opts: _QueryOptions) {
    super(proto, opts);
  }

  get className(): string {
    const { className, key } = this._opts.relatedBy!;
    const { dataType } = resolveColumn(this._proto.schema, className, key);
    if (!isPointer(dataType) && !isRelation(dataType)) throw Error(`Invalid relation key: ${key}`);
    return dataType.target;
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoRelationQuery(this._proto, this._opts);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  subscribe(): LiveQuerySubscription<string, E> {
    throw Error('Unable to subscribe to relationship query');
  }
}
