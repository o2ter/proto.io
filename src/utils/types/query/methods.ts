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
import { Proto } from '../proto';
import { PObject } from '../object';
import { PSchema } from '../schema';

const validateCLPs = (
  clps: PSchema.CLPs,
  keys: (keyof PSchema.CLPs)[],
  acls: string[],
) => {
  for (const key of keys) {
    if (_.includes(clps[key], '*')) continue;
    if (_.every(clps[key], x => !_.includes(acls, x))) return false;
  }
  return true;
}

const asyncIterableToArray = async <T>(asyncIterable: AsyncIterable<T>) => {
  const array: T[] = [];
  for await (const obj of asyncIterable) array.push(obj);
  return array;
}

export const objectMethods = (
  object: PObject,
  proto: Proto,
) => {

  const props = {
    save: {
      value: async (master?: boolean) => {
      },
    },
    destory: {
      value: async (master?: boolean) => {
        await proto.query(object.className, master).filter({ _id: object.objectId }).findOneAndDelete();
      },
    },
  }

  return Object.defineProperties(object, props);
}

export const queryMethods = (
  query: Query,
  proto: Proto,
  master: boolean,
) => {

  const acls = () => [
    ..._.map(proto.roles, x => `role:${x}`),
    proto.user?.objectId,
  ].filter(Boolean) as string[];

  const options = () => ({
    acls: acls(), master,
    model: query.model,
    ...query.options,
  });

  const _validateCLPs = (...keys: (keyof PSchema.CLPs)[]) => validateCLPs(
    proto.schema[query.model]?.classLevelPermissions ?? {},
    keys, acls(),
  );

  const props = {
    count: {
      value: async () => {
        if (!master && !_validateCLPs('count')) throw new Error('No permission');
        return proto.storage.count(options());
      },
    },
    then: {
      get() {
        return asyncIterableToArray(query).then;
      },
    },
    [Symbol.asyncIterator]: {
      value: async function*() {
        if (!master && !_validateCLPs('find')) throw new Error('No permission');
        for await (const object of proto.storage.find(options())) return objectMethods(object, proto);
      },
    },
    insert: {
      value: async (attrs: any) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.model];
        const afterSave = proto.triggers?.afterSave?.[query.model];
        if (!master && !_validateCLPs('create')) throw new Error('No permission');

        const object = new PObject(query.model, _.omit(attrs, '_id', '_created_at', '_updated_at'));
        if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object }, proto));

        const result = await proto.storage.insert(query.model, _.fromPairs(object.keys().map(k => [k, object.get(k)])));
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndUpdate: {
      value: async (update: Record<string, any>) => {
        //FIXME: beforeSave does not implement yet.
        const beforeSave = proto.triggers?.beforeSave?.[query.model];
        const afterSave = proto.triggers?.afterSave?.[query.model];
        if (!master && !_validateCLPs('update')) throw new Error('No permission');

        const result = await proto.storage.findOneAndUpdate(options(), update);
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndUpsert: {
      value: async (update: Record<string, any>, setOnInsert: Record<string, any>) => {
        //FIXME: beforeSave does not implement yet.
        const beforeSave = proto.triggers?.beforeSave?.[query.model];
        const afterSave = proto.triggers?.afterSave?.[query.model];
        if (!master && !_validateCLPs('create', 'update')) throw new Error('No permission');

        const result = await proto.storage.findOneAndUpsert(options(), update, setOnInsert);
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.model];
        const afterDelete = proto.triggers?.afterDelete?.[query.model];
        if (!master && !_validateCLPs('delete')) throw new Error('No permission');

        let result: PObject | undefined;

        if (_.isFunction(beforeDelete)) {

          const [object] = await asyncIterableToArray(proto.storage.find({ ...options(), limit: 1 }));
          if (!object) return undefined;
          await beforeDelete(Object.setPrototypeOf({ object }, proto));

          result = await proto.storage.findOneAndDelete({
            ...options(),
            filter: { _id: object.objectId },
          });

        } else {
          result = await proto.storage.findOneAndDelete(options());
        }

        if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.model];
        const afterDelete = proto.triggers?.afterDelete?.[query.model];
        if (!master && !_validateCLPs('delete')) throw new Error('No permission');

        if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

          const objects = await asyncIterableToArray(proto.storage.find(options()));
          if (_.isEmpty(objects)) return 0;

          if (_.isFunction(beforeDelete)) {
            await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({ object }, proto))));
          }

          await proto.storage.findAndDelete({
            ...options(),
            filter: { _id: { $in: _.map(objects, x => x.objectId) } },
          });

          if (_.isFunction(afterDelete)) {
            await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({ object }, proto))));
          }

          return objects.length;
        }

        return proto.storage.findAndDelete(options());
      },
    },
  };

  return Object.defineProperties(query, props);
}
