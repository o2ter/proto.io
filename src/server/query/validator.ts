//
//  validator.ts
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
import { Proto } from '../index';
import { TSchema, TObject, FindOptions, FindOneOptions, UpdateOperation, ExtraOptions } from '../../internals';

const validateCLPs = (
  clps: TSchema.CLPs,
  keys: (keyof TSchema.CLPs)[],
  acls: string[],
) => {
  for (const key of keys) {
    if (_.includes(clps[key], '*')) continue;
    if (_.every(clps[key], x => !_.includes(acls, x))) return false;
  }
  return true;
}

export const queryValidator = <E>(proto: Proto<E>, className: string, options?: ExtraOptions) => {

  const acls = () => [
    ..._.map(proto.roles, x => `role:${x}`),
    proto.user?.objectId,
  ].filter(Boolean) as string[];

  const _validateCLPs = (...keys: (keyof TSchema.CLPs)[]) => validateCLPs(
    proto.schema[className]?.classLevelPermissions ?? {},
    keys, acls(),
  );

  return {
    count(
      query: FindOptions,
    ) {
      if (!options?.master && !_validateCLPs('count')) throw new Error('No permission');
      return proto.storage.count(query);
    },
    find(
      query: FindOptions,
    ) {
      if (!options?.master && !_validateCLPs('find')) throw new Error('No permission');
      return proto.storage.find(query);
    },
    insert(
      className: string,
      attrs: Record<string, any>,
    ) {
      if (!options?.master && !_validateCLPs('create')) throw new Error('No permission');
      return proto.storage.insert(className, attrs);
    },
    findOneAndUpdate(
      query: FindOneOptions,
      update: Record<string, [UpdateOperation, any]>,
    ) {
      if (!options?.master && !_validateCLPs('update')) throw new Error('No permission');
      return proto.storage.findOneAndUpdate(query, update);
    },
    findOneAndReplace(
      query: FindOneOptions,
      replacement: Record<string, any>,
    ) {
      if (!options?.master && !_validateCLPs('update')) throw new Error('No permission');
      return proto.storage.findOneAndReplace(query, replacement);
    },
    findOneAndUpsert(
      query: FindOneOptions,
      update: Record<string, [UpdateOperation, any]>,
      setOnInsert: Record<string, any>,
    ) {
      if (!options?.master && !_validateCLPs('create', 'update')) throw new Error('No permission');
      return proto.storage.findOneAndUpsert(query, update, setOnInsert);
    },
    findOneAndDelete(
      query: FindOneOptions,
    ) {
      if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');
      return proto.storage.findOneAndDelete(query);
    },
    findAndDelete(
      query: FindOptions,
    ) {
      if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');
      return proto.storage.findAndDelete(query);
    },
  };
}