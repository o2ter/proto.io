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
import { TQuery } from '../common/query';
import { TObject, UpdateOperation } from '../common/object';
import { PVK } from '../common/private';
import Proto from './index';
import { RequestOptions } from './options';

export const queryMethods = <T extends string, E>(query: TQuery<T, E>, proto: Proto<E>, options?: RequestOptions) => {

  const queryOptions = () => ({
    className: query[PVK].className,
    ...query[PVK].options,
  }) as any;

  const requestOpt = {
    method: 'post',
    url: `classes/${query.className}`,
    serializeOpts: {
      objAttrs: TObject.defaultReadonlyKeys,
    },
    ...(options ?? {}),
  };

  const props = {
    count: {
      value: () => proto[PVK].request({
        operation: 'count',
        ...queryOptions(),
      }, requestOpt),
    },
    then: {
      get() {
        return proto[PVK].request({
          operation: 'find',
          ...queryOptions(),
        }, requestOpt);
      },
    },
    [Symbol.asyncIterator]: {
      value: async function* () {
        for (const object of await query) yield object;
      },
    },
    insert: {
      value: (attrs: any) => proto[PVK].request({
        operation: 'insert',
        attributes: attrs,
      }, requestOpt),
    },
    findOneAndUpdate: {
      value: (update: Record<string, [UpdateOperation, any]>) => proto[PVK].request({
        operation: 'findOneAndUpdate',
        update,
        ...queryOptions(),
      }, requestOpt),
    },
    findOneAndReplace: {
      value: (replacement: Record<string, any>) => proto[PVK].request({
        operation: 'findOneAndReplace',
        replacement,
        ...queryOptions(),
      }, requestOpt),
    },
    findOneAndUpsert: {
      value: (update: Record<string, [UpdateOperation, any]>, setOnInsert: Record<string, any>) => proto[PVK].request({
        operation: 'findOneAndUpsert',
        update,
        setOnInsert,
        ...queryOptions(),
      }, requestOpt),
    },
    findOneAndDelete: {
      value: () => proto[PVK].request({
        operation: 'findOneAndDelete',
        ...queryOptions(),
      }, requestOpt),
    },
    findAndDelete: {
      value: () => proto[PVK].request({
        operation: 'findAndDelete',
        ...queryOptions(),
      }, requestOpt),
    },
  };

  return Object.defineProperties(query, props);
}