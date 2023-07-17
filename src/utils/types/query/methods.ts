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
import { IOObject } from '../object';
import { IOSchema } from '../schema';
import { privateKey } from '../private';

const validateCLPs = (
  clps: IOSchema.CLPs,
  keys: (keyof IOSchema.CLPs)[],
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
  object: IOObject | undefined,
  proto: Proto,
) => object ? Object.defineProperties(object, {
  save: {
    value: async (master?: boolean) => {
      await proto.query(object.className, master).findOneAndUpdate(object[privateKey].mutated);
    },
  },
  destory: {
    value: async (master?: boolean) => {
      await proto.query(object.className, master).filter({ _id: object.objectId }).findOneAndDelete();
    },
  },
}) : undefined;

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
    className: query.className,
    ...query[privateKey].options,
  });

  const _validateCLPs = (...keys: (keyof IOSchema.CLPs)[]) => validateCLPs(
    proto.schema[query.className]?.classLevelPermissions ?? {},
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
      value: async function* () {
        if (!master && !_validateCLPs('find')) throw new Error('No permission');
        for await (const object of proto.storage.find(options())) yield objectMethods(object, proto);
      },
    },
    insert: {
      value: async (attrs: any) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!master && !_validateCLPs('create')) throw new Error('No permission');

        const object = objectMethods(new IOObject(query.className, _.omit(attrs, '_id', '_created_at', '_updated_at')), proto) as IOObject;
        if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object }, proto));

        const result = objectMethods(
          await proto.storage.insert(query.className, _.fromPairs(object.keys().map(k => [k, object.get(k)]))),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndUpdate: {
      value: async (update: Record<string, any>) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!master && !_validateCLPs('update')) throw new Error('No permission');

        if (_.isFunction(beforeSave)) {

          const [object] = _.map(
            await asyncIterableToArray(proto.storage.find({ ...options(), limit: 1 })),
            x => objectMethods(x, proto),
          );

          if (!object) return undefined;
          object[privateKey].mutated = update;
          await beforeSave(Object.setPrototypeOf({ object }, proto));

          update = object[privateKey].mutated;
        }

        const result = objectMethods(
          await proto.storage.findOneAndUpdate(options(), update),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndUpsert: {
      value: async (update: Record<string, any>, setOnInsert: Record<string, any>) => {
        //FIXME: beforeSave does not implement yet.
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!master && !_validateCLPs('create', 'update')) throw new Error('No permission');

        const result = objectMethods(
          await proto.storage.findOneAndUpsert(options(), update, setOnInsert),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findOneAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.className];
        const afterDelete = proto.triggers?.afterDelete?.[query.className];
        if (!master && !_validateCLPs('delete')) throw new Error('No permission');

        let result: IOObject | undefined;

        if (_.isFunction(beforeDelete)) {

          const [object] = _.map(
            await asyncIterableToArray(proto.storage.find({ ...options(), limit: 1 })),
            x => objectMethods(x, proto),
          );
          if (!object) return undefined;
          await beforeDelete(Object.setPrototypeOf({ object }, proto));

          result = objectMethods(
            await proto.storage.findOneAndDelete({
              ...options(),
              filter: { _id: object.objectId },
            }),
            proto,
          );

        } else {
          result = objectMethods(
            await proto.storage.findOneAndDelete(options()),
            proto,
          );
        }

        if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result }, proto));
        return result;
      },
    },
    findAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.className];
        const afterDelete = proto.triggers?.afterDelete?.[query.className];
        if (!master && !_validateCLPs('delete')) throw new Error('No permission');

        if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

          const objects = _.map(
            await asyncIterableToArray(proto.storage.find(options())),
            x => objectMethods(x, proto),
          ) as IOObject[];
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
