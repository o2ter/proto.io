//
//  query.ts
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
import { ProtoClient } from './proto';
import { RequestOptions } from './options';
import {
  PVK,
  TQuery,
  TObject,
  TValue,
  asyncStream,
  TObjectType,
  TQueryOptions,
  TUpdateOp,
  PathName,
} from '../internals';

export class ProtoClientQuery<T extends string, E> extends TQuery<T, E> {

  private _proto: ProtoClient<E>;
  private _options?: RequestOptions;

  constructor(className: T, proto: ProtoClient<E>, options?: RequestOptions) {
    super(className);
    this._proto = proto;
    this._options = options;
  }

  private get _queryOptions() {
    return {
      className: this[PVK].className,
      ...this[PVK].options,
    } as any;
  }

  private get _requestOpt() {
    const { context, ...opts } = this._options ?? {};
    return {
      method: 'post',
      url: `classes/${this.className}`,
      serializeOpts: {
        objAttrs: TObject.defaultReadonlyKeys,
      },
      ...opts,
    };
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoClientQuery(this.className, this._proto, this._options);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  explain() {
    return this._proto[PVK].request({
      operation: 'explain',
      context: this._options?.context ?? {},
      ...this._queryOptions,
    }, this._requestOpt);
  }

  count() {
    return this._proto[PVK].request({
      operation: 'count',
      context: this._options?.context ?? {},
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

  find() {
    const request = () => this._proto[PVK].request({
      operation: 'find',
      context: this._options?.context ?? {},
      ...this._queryOptions,
    }, this._requestOpt) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  random(weight?: string) {
    const request = () => this._proto[PVK].request({
      operation: 'random',
      context: this._options?.context ?? {},
      weight,
      ...this._queryOptions,
    }, this._requestOpt) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  insert(attrs: Record<string, TValue>) {
    return this._proto[PVK].request({
      operation: 'insert',
      context: this._options?.context ?? {},
      attributes: attrs,
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

  updateOne(update: Record<string, TUpdateOp>) {
    return this._proto[PVK].request({
      operation: 'updateOne',
      context: this._options?.context ?? {},
      update,
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

  upsertOne(update: Record<string, TUpdateOp>, setOnInsert: Record<string, TValue>) {
    return this._proto[PVK].request({
      operation: 'upsertOne',
      context: this._options?.context ?? {},
      update,
      setOnInsert,
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

  deleteOne() {
    return this._proto[PVK].request({
      operation: 'deleteOne',
      context: this._options?.context ?? {},
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

  deleteMany() {
    return this._proto[PVK].request({
      operation: 'deleteMany',
      context: this._options?.context ?? {},
      ...this._queryOptions,
    }, this._requestOpt) as any;
  }

}