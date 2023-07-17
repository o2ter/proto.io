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
import { Query } from '../utils/types/query';
import { PObject } from '../utils/types';
import Proto from './index';

export const objectMethods = (
  object: PObject,
  proto: Proto,
) => {

  const props = {
    save: {
      value: async () => {
      },
    },
    destory: {
      value: async () => {
        await proto.query(object.className).filter({ _id: object.objectId }).findOneAndDelete();
      },
    },
  }

  return Object.defineProperties(object, props);
}

export const queryMethods = (query: Query, proto: Proto) => {

  const options = () => ({
    model: query.model,
    ...query.options,
  }) as any;

  const requestOpt = {
    method: 'post',
    url: `classes/${query.model}`,
  };

  const props = {
    count: {
      value: () => proto._request({
        operation: 'count',
        ...options(),
      }, requestOpt),
    },
    then: {
      get() {
        return proto._request({
          operation: 'find',
          ...options(),
        }, requestOpt);
      },
    },
    insert: {
      value: (attrs: any) => proto._request({
        operation: 'insert',
        attributes: attrs,
      }, requestOpt),
    },
    findOneAndUpdate: {
      value: (update: Record<string, any>) => proto._request({
        operation: 'findOneAndUpdate',
        update,
        ...options(),
      }, requestOpt),
    },
    findOneAndUpsert: {
      value: (update: Record<string, any>, setOnInsert: Record<string, any>) => proto._request({
        operation: 'findOneAndUpsert',
        update,
        setOnInsert,
        ...options(),
      }, requestOpt),
    },
    findOneAndDelete: {
      value: () => proto._request({
        operation: 'findOneAndDelete',
        ...options(),
      }, requestOpt),
    },
    findAndDelete: {
      value: () => proto._request({
        operation: 'findAndDelete',
        ...options(),
      }, requestOpt),
    },
  };

  return Object.defineProperties(query, props);
}