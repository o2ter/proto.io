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
} from '../internals';

export const applyQueryMethods = <T extends string, E>(query: TQuery<T, E>, proto: ProtoClient<E>, options?: RequestOptions) => {

  const queryOptions = (query: TQuery<T, E>) => ({
    className: query[PVK].className,
    ...query[PVK].options,
  }) as any;

  const requestOpt = (query: TQuery<T, E>) => ({
    method: 'post',
    url: `classes/${query.className}`,
    serializeOpts: {
      objAttrs: TObject.defaultReadonlyKeys,
    },
    ...(options ?? {}),
  });

  const props: PropertyDescriptorMap & ThisType<TQuery<T, E>> = {
    explain: {
      value() {
        return proto[PVK].request({
          operation: 'explain',
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    count: {
      value() {
        return proto[PVK].request({
          operation: 'count',
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    find: {
      value() {
        const request = () => proto[PVK].request({
          operation: 'find',
          ...queryOptions(this),
        }, requestOpt(this)) as Promise<TObject[]>;
        return {
          get then() {
            return request().then;
          },
          [Symbol.asyncIterator]: async function* () {
            for (const object of await request()) yield object;
          },
        };
      },
    },
    insert: {
      value(attrs: Record<string, any>) {
        return proto[PVK].request({
          operation: 'insert',
          attributes: attrs,
        }, requestOpt(this));
      },
    },
    findOneAndUpdate: {
      value(update: Record<string, [UpdateOp, TValue]>) {
        return proto[PVK].request({
          operation: 'findOneAndUpdate',
          update,
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    findOneAndReplace: {
      value(replacement: Record<string, any>) {
        return proto[PVK].request({
          operation: 'findOneAndReplace',
          replacement,
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    findOneAndUpsert: {
      value(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, any>) {
        return proto[PVK].request({
          operation: 'findOneAndUpsert',
          update,
          setOnInsert,
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    findOneAndDelete: {
      value() {
        return proto[PVK].request({
          operation: 'findOneAndDelete',
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
    findAndDelete: {
      value() {
        return proto[PVK].request({
          operation: 'findAndDelete',
          ...queryOptions(this),
        }, requestOpt(this));
      },
    },
  };

  return Object.defineProperties(query, props);
}