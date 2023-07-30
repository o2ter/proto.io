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
import ProtoClient from './index';
import { RequestOptions } from './options';
import {
  PVK,
  TQuery,
  TObject,
  UpdateOp,
  TValue,
  asyncStream,
  TObjectType,
} from '../internals';

export class ProtoClientQuery<T extends string, E> extends TQuery<T, E> {

  private proto: ProtoClient<E>;
  private options?: RequestOptions;

  constructor(className: T, proto: ProtoClient<E>, options?: RequestOptions) {
    super(className);
    this.proto = proto;
    this.options = options;
  }

  private get queryOptions() {
    return {
      className: this[PVK].className,
      ...this[PVK].options,
    } as any;
  }

  private get requestOpt() {
    const { context, ...opts } = this.options ?? {};
    return {
      method: 'post',
      url: `classes/${this.className}`,
      serializeOpts: {
        objAttrs: TObject.defaultReadonlyKeys,
      },
      ...opts,
    };
  }

  clone(options?: TQuery.Options) {
    const clone = new ProtoClientQuery(this.className, this.proto, this.options);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  explain() {
    return this.proto[PVK].request({
      operation: 'explain',
      context: this.options?.context ?? {},
      ...this.queryOptions,
    }, this.requestOpt);
  }

  count() {
    return this.proto[PVK].request({
      operation: 'count',
      context: this.options?.context ?? {},
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

  find() {
    const request = () => this.proto[PVK].request({
      operation: 'find',
      context: this.options?.context ?? {},
      ...this.queryOptions,
    }, this.requestOpt) as Promise<TObjectType<T, E>[]>;
    return asyncStream(request);
  }

  insert(attrs: Record<string, TValue>) {
    return this.proto[PVK].request({
      operation: 'insert',
      context: this.options?.context ?? {},
      attributes: attrs,
    }, this.requestOpt) as any;
  }

  findOneAndUpdate(update: Record<string, [UpdateOp, TValue]>) {
    return this.proto[PVK].request({
      operation: 'findOneAndUpdate',
      context: this.options?.context ?? {},
      update,
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

  findOneAndReplace(replacement: Record<string, TValue>) {
    return this.proto[PVK].request({
      operation: 'findOneAndReplace',
      context: this.options?.context ?? {},
      replacement,
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

  findOneAndUpsert(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    return this.proto[PVK].request({
      operation: 'findOneAndUpsert',
      context: this.options?.context ?? {},
      update,
      setOnInsert,
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

  findOneAndDelete() {
    return this.proto[PVK].request({
      operation: 'findOneAndDelete',
      context: this.options?.context ?? {},
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

  findAndDelete() {
    return this.proto[PVK].request({
      operation: 'findAndDelete',
      context: this.options?.context ?? {},
      ...this.queryOptions,
    }, this.requestOpt) as any;
  }

}