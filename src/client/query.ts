//
//  query.ts
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
import { ProtoClient } from './proto';
import { RequestOptions } from './options';
import { asyncStream } from '@o2ter/utils-js';
import { PVK } from '../internals/private';
import { TQuery, TQueryOptions, TQueryRandomOptions } from '../internals/query';
import { TObject } from '../internals/object';
import { TObjectType, TUpdateOp } from '../internals/object/types';
import { TValue } from '../internals/types';

type _QueryOptions = {
  relatedBy?: {
    className: string;
    objectId: string;
    key: string;
  };
};

export class ProtoClientQuery<T extends string, E> extends TQuery<T, E, boolean> {

  private _proto: ProtoClient<E>;
  private _opts: _QueryOptions;

  constructor(className: T, proto: ProtoClient<E>, opts: _QueryOptions) {
    super(className);
    this._proto = proto;
    this._opts = opts;
  }

  private get _queryOptions() {
    return {
      className: this[PVK].className,
      relatedBy: this._opts.relatedBy,
      ...this[PVK].options,
    } as any;
  }

  private _requestOpt(options?: RequestOptions<boolean>) {
    const { context, ...opts } = options ?? {};
    return {
      method: 'post',
      url: `classes/${encodeURIComponent(this.className)}`,
      serializeOpts: {
        objAttrs: TObject.defaultReadonlyKeys,
      },
      ...opts,
    };
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoClientQuery(this.className, this._proto, this._opts);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  explain(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'explain',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options));
  }

  count(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'count',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  find(options?: RequestOptions<boolean>) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'find',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  random(
    opts?: TQueryRandomOptions,
    options?: RequestOptions<boolean>
  ) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'random',
      context: options?.context ?? {},
      silent: options?.silent,
      random: opts,
      ...this._queryOptions,
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  nonrefs(options?: RequestOptions<boolean>) {
    const request = () => this._proto[PVK].request(this._proto, {
      operation: 'nonrefs',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options)) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  insert(
    attrs: Record<string, TValue>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'insert',
      context: options?.context ?? {},
      silent: options?.silent,
      attributes: attrs,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  insertMany(
    values: Record<string, TValue>[],
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'insertMany',
      context: options?.context ?? {},
      silent: options?.silent,
      attributes: values,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  updateOne(
    update: Record<string, TUpdateOp>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'updateOne',
      context: options?.context ?? {},
      silent: options?.silent,
      update,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  upsertOne(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValue>,
    options?: RequestOptions<boolean>
  ) {
    return this._proto[PVK].request(this._proto, {
      operation: 'upsertOne',
      context: options?.context ?? {},
      silent: options?.silent,
      update,
      setOnInsert,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  deleteOne(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'deleteOne',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

  deleteMany(options?: RequestOptions<boolean>) {
    return this._proto[PVK].request(this._proto, {
      operation: 'deleteMany',
      context: options?.context ?? {},
      silent: options?.silent,
      ...this._queryOptions,
    }, this._requestOpt(options)) as any;
  }

}