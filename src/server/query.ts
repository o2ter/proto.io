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
import { Query } from '../types/query';
import { Proto } from '.';
import { IOObject, UpdateOperation } from '../types/object';
import { IOSchema } from '../types/schema';
import { PVK } from '../types/private';
import { ExtraOptions } from '../types/options';
import { objectMethods } from '../types/object/methods';
import { asyncIterableToArray } from '../utils';

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

export const queryMethods = <E, T extends string>(
  query: Query<E, T>,
  proto: Proto<E>,
  options?: ExtraOptions,
) => {

  const acls = () => [
    ..._.map(proto.roles, x => `role:${x}`),
    proto.user?.objectId,
  ].filter(Boolean) as string[];

  const queryOptions = () => ({
    className: query.className,
    options: {
      acls: acls(),
      ...(options ?? {}),
    },
    ...query[PVK].options,
  });

  const _validateCLPs = (...keys: (keyof IOSchema.CLPs)[]) => validateCLPs(
    proto.schema[query.className]?.classLevelPermissions ?? {},
    keys, acls(),
  );

  const props = {
    count: {
      value: async () => {
        if (!options?.master && !_validateCLPs('count')) throw new Error('No permission');
        return proto.storage.count(queryOptions());
      },
    },
    then: {
      get() {
        return asyncIterableToArray(query).then;
      },
    },
    [Symbol.asyncIterator]: {
      value: async function* () {
        if (!options?.master && !_validateCLPs('find')) throw new Error('No permission');
        for await (const object of proto.storage.find(queryOptions())) yield objectMethods(object, proto);
      },
    },
    insert: {
      value: async (attrs: any) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!options?.master && !_validateCLPs('create')) throw new Error('No permission');

        const context = {};

        const object = objectMethods(new IOObject(query.className, _.omit(attrs, '_id', '_created_at', '_updated_at')), proto);
        if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object, context }, proto));

        const result = objectMethods(
          await proto.storage.insert(query.className, _.fromPairs(object.keys().map(k => [k, object.get(k)]))),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpdate: {
      value: async (update: Record<string, [UpdateOperation, any]>) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!options?.master && !_validateCLPs('update')) throw new Error('No permission');

        const context = {};

        if (_.isFunction(beforeSave)) {

          const object = objectMethods(_.first(await asyncIterableToArray(proto.storage.find({ ...queryOptions(), limit: 1 }))), proto);
          if (!object) return undefined;

          object[PVK].mutated = update;
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          update = object[PVK].mutated;
        }

        const result = objectMethods(
          await proto.storage.findOneAndUpdate(queryOptions(), update),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpsert: {
      value: async (update: Record<string, [UpdateOperation, any]>, setOnInsert: Record<string, any>) => {
        const beforeSave = proto.triggers?.beforeSave?.[query.className];
        const afterSave = proto.triggers?.afterSave?.[query.className];
        if (!options?.master && !_validateCLPs('create', 'update')) throw new Error('No permission');

        const context = {};

        if (_.isFunction(beforeSave)) {

          let object = objectMethods(_.first(await asyncIterableToArray(proto.storage.find({ ...queryOptions(), limit: 1 }))), proto);

          if (object) {
            object[PVK].mutated = update;
          } else {
            object = objectMethods(new IOObject(query.className, _.omit(setOnInsert, '_id', '_created_at', '_updated_at')), proto);
          }
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));  

          if (object.objectId) {
            update = object[PVK].mutated;
          } else {
            setOnInsert = _.mapValues(_.pickBy(object[PVK].mutated, v => v[0] === UpdateOperation.set), v => v[1]);
          }
        }

        const result = objectMethods(
          await proto.storage.findOneAndUpsert(queryOptions(), update, setOnInsert),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.className];
        const afterDelete = proto.triggers?.afterDelete?.[query.className];
        if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');

        const context = {};
        let result: IOObject | undefined;

        if (_.isFunction(beforeDelete)) {

          const object = objectMethods(_.first(await asyncIterableToArray(proto.storage.find({ ...queryOptions(), limit: 1 }))), proto);
          if (!object) return undefined;

          await beforeDelete(Object.setPrototypeOf({ object, context }, proto));

          result = objectMethods(
            await proto.storage.findOneAndDelete({
              ...queryOptions(),
              filter: { _id: object.objectId },
            }),
            proto,
          );

        } else {
          result = objectMethods(
            await proto.storage.findOneAndDelete(queryOptions()),
            proto,
          );
        }

        if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findAndDelete: {
      value: async () => {
        const beforeDelete = proto.triggers?.beforeDelete?.[query.className];
        const afterDelete = proto.triggers?.afterDelete?.[query.className];
        if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');

        if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

          const objects = objectMethods(await asyncIterableToArray(proto.storage.find(queryOptions())), proto);
          if (_.isEmpty(objects)) return 0;

          const context: Record<string, any> = {};
          objects.forEach(x => context[x.objectId as string] = {});

          if (_.isFunction(beforeDelete)) {
            await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({
              object,
              context: context[object.objectId as string],
            }, proto))));
          }

          await proto.storage.findAndDelete({
            ...queryOptions(),
            filter: { _id: { $in: _.map(objects, x => x.objectId) } },
          });

          if (_.isFunction(afterDelete)) {
            await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({
              object,
              context: context[object.objectId as string],
            }, proto))));
          }

          return objects.length;
        }

        return proto.storage.findAndDelete(queryOptions());
      },
    },
  };

  return Object.defineProperties(query, props);
}
