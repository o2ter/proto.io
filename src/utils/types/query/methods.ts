//
//  methods.ts
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
import { Query } from './index';
import { PObject } from '../object';
import { Proto } from '../proto';
import { PSchema } from '../schema';

declare module './index' {
  export interface Query {
    count: () => PromiseLike<number>;
    then: Promise<PObject[]>['then'];
    [Symbol.asyncIterator]: AsyncIterator<PObject>;
    insert: (attrs: any) => PromiseLike<PObject | undefined>;
    findOneAndUpdate: (update: any) => PromiseLike<PObject | undefined>;
    findOneAndUpsert: (update: any, setOnInsert: any) => PromiseLike<PObject | undefined>;
    findOneAndDelete: () => PromiseLike<PObject | undefined>;
    findAndDelete: () => PromiseLike<PObject | undefined>;
  }
}

const validateCLPs = (clps: PSchema.CLPs, keys: (keyof PSchema.CLPs)[], acls: string[]) => {
  for (const key of keys) {
    if (_.includes(clps[key], '*')) continue;
    if (_.every(clps[key], x => !_.includes(acls, x))) return false;
  }
  return true;
}

export const queryMethods = (query: Query, proto: Proto, acls: string[]) => {

  const options = () => ({
    acls,
    model: query.model,
    ...query.options,
  });

  const _validateCLPs = (...keys: (keyof PSchema.CLPs)[]) => validateCLPs(
    proto.schema[query.model]?.classLevelPermissions ?? {},
    keys,
    acls,
  );

  const props = {
    count: {
      value: () => {
        if (!_validateCLPs('count')) throw new Error('No permission');
        return proto.storage.count(options());
      },
    },
    then: {
      get() {
        const result = (async () => {
          if (!_validateCLPs('find')) throw new Error('No permission');
          const array: PObject[] = [];
          for await (const obj of proto.storage.find(options())) array.push(obj);
          return array;
        })();
        return result.then;
      },
    },
    [Symbol.asyncIterator]: {
      get() {
        if (!_validateCLPs('find')) throw new Error('No permission');
        return proto.storage.find(options())[Symbol.asyncIterator];
      },
    },
    insert: {
      value: (attrs: any) => {
        if (!_validateCLPs('create')) throw new Error('No permission');
        return proto.storage.insert(query.model, attrs);
      },
    },
    findOneAndUpdate: {
      value: (update: any) => {
        if (!_validateCLPs('update')) throw new Error('No permission');
        return proto.storage.findOneAndUpdate(options(), update);
      },
    },
    findOneAndUpsert: {
      value: (update: any, setOnInsert: any) => {
        if (!_validateCLPs('create', 'update')) throw new Error('No permission');
        return proto.storage.findOneAndUpsert(options(), update, setOnInsert);
      },
    },
    findOneAndDelete: {
      value: () => {
        if (!_validateCLPs('delete')) throw new Error('No permission');
        return proto.storage.findOneAndDelete(options());
      },
    },
    findAndDelete: {
      value: () => {
        if (!_validateCLPs('delete')) throw new Error('No permission');
        return proto.storage.findAndDelete(options());
      },
    },
  };

  return Object.defineProperties(query, props);
}
