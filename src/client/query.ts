//
//  query.ts
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
import { ProtoClient } from './proto';
import { RequestOptions } from './options';
import { asyncStream } from '@o2ter/utils-js';
import { PVK } from '../internals/private';
import { TQuery, TQueryOptions, TQueryRandomOptions } from '../internals/query';
import { TObject } from '../internals/object';
import { TObjectType, TUpdateOp } from '../internals/object/types';
import { TValueWithUndefined } from '../internals/types';
import { LiveQuerySubscription } from '../internals/liveQuery';
import { TAccumulatorResult, TQueryAccumulator } from '../internals/query/types/accumulators';

type _QueryOptions = {
  relatedBy?: {
    className: string;
    id: string;
    key: string;
  };
};

abstract class _ProtoClientQuery<T extends string, E> extends TQuery<T, E, boolean> {

  protected _proto: ProtoClient<E>;
  protected _opts: _QueryOptions;

  constructor(proto: ProtoClient<E>, opts: _QueryOptions) {
    super();
    this._proto = proto;
    this._opts = opts;
  }

  abstract get url(): string;
  abstract get className(): T | undefined;

  private _queryOptions({
    silent,
  }: RequestOptions<boolean> = {}) {
    return {
      className: this.className,
      relatedBy: this._opts.relatedBy,
      silent,
      ...this[PVK].options,
    } as any;
  }

  private _requestOpt({
    silent,
    ...opts
  }: RequestOptions<boolean> = {}) {
    return {
      method: 'post',
      url: this.url,
      serializeOpts: {
        objAttrs: TObject.defaultReadonlyKeys,
      },
      ...opts,
    };
  }

  explain(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'explain',
      ...this._queryOptions(options),
    }, this._requestOpt(options));
  }

  count(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'count',
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  find(options?: RequestOptions<boolean>) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'find',
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  groupFind<T extends Record<string, TQueryAccumulator>>(
    accumulators: T,
    options?: RequestOptions<boolean>
  ): Promise<{ [K in keyof T]: TAccumulatorResult<T[K]>; }> {
    return this._proto[PVK].request(this._proto, {
      operation: 'groupFind',
      accumulators,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  random(
    opts?: TQueryRandomOptions,
    options?: RequestOptions<boolean>
  ) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'random',
      random: opts,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  nonrefs(options?: RequestOptions<boolean>) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'nonrefs',
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  insert(
    attrs: Record<string, TValueWithUndefined>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'insert',
      attributes: attrs,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  insertMany(
    values: Record<string, TValueWithUndefined>[],
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'insertMany',
      attributes: values,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  updateOne(
    update: Record<string, TUpdateOp>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'updateOne',
      update,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  updateMany(
    update: Record<string, TUpdateOp>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'updateMany',
      update,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  upsertOne(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValueWithUndefined>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'upsertOne',
      update,
      setOnInsert,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  upsertMany(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValueWithUndefined>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'upsertMany',
      update,
      setOnInsert,
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  deleteOne(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'deleteOne',
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

  deleteMany(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'deleteMany',
      ...this._queryOptions(options),
    }, this._requestOpt(options)) as any;
  }

}

export class ProtoClientQuery<T extends string, E> extends _ProtoClientQuery<T, E> {

  private _className: T;

  constructor(className: T, proto: ProtoClient<E>, opts: _QueryOptions) {
    super(proto, opts);
    this._className = className;
  }

  get url(): string {
    return `classes/${encodeURIComponent(this.className)}`;
  }
  get className(): T {
    return this._className;
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoClientQuery(this.className, this._proto, this._opts);
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
export class ProtoClientRelationQuery<E> extends _ProtoClientQuery<string, E> {

  constructor(proto: ProtoClient<E>, opts: _QueryOptions) {
    super(proto, opts);
  }

  get url(): string {
    return `relation`;
  }
  get className(): undefined {
    return undefined;
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoClientRelationQuery(this._proto, this._opts);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  subscribe(): LiveQuerySubscription<string, E> {
    throw Error('Unable to subscribe to relationship query');
  }
}