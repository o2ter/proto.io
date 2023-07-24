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
import { Proto } from '../index';
import {
  PVK,
  TQuery,
  TObject,
  UpdateOp,
  ExtraOptions,
  applyObjectMethods,
  asyncIterableToArray,
} from '../../internals';
import { queryValidator } from './validator';

export const applyQueryMethods = <T extends string, E>(
  query: TQuery<T, E>,
  proto: Proto<E>,
  options?: ExtraOptions,
) => {

  const queryOptions = () => ({
    className: query.className,
    options: options ?? {},
    ...query[PVK].options,
  });

  const storage = () => queryValidator(proto, query.className, options);

  const props = {
    count: {
      value: async () => {
        return storage().count(queryOptions());
      },
    },
    then: {
      get() {
        return asyncIterableToArray(query).then;
      },
    },
    [Symbol.asyncIterator]: {
      value: async function*() {
        for await (const object of storage().find(queryOptions())) yield applyObjectMethods(object, proto);
      },
    },
    insert: {
      value: async (attrs: Record<string, any>) => {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[query.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[query.className];

        const context = {};

        const object = proto.Object(query.className);
        for (const [key, value] of _.toPairs(_.omit(attrs, ...TObject.defaultReadonlyKeys))) {
          object[PVK].mutated[key] = [UpdateOp.set, value];
        }

        if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object, context }, proto));

        const result = applyObjectMethods(
          await storage().insert(query.className, _.fromPairs(object.keys().map(k => [k, object.get(k)]))),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpdate: {
      value: async (update: Record<string, [UpdateOp, any]>) => {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[query.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[query.className];

        const context = {};

        if (_.isFunction(beforeSave)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage().find({ ...queryOptions(), limit: 1 }))), proto);
          if (!object) return undefined;

          object[PVK].mutated = _.omit(update, ...TObject.defaultReadonlyKeys);
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          update = object[PVK].mutated;
        }

        const result = applyObjectMethods(
          await storage().findOneAndUpdate(queryOptions(), _.omit(update, ...TObject.defaultReadonlyKeys)),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndReplace: {
      value: async (replacement: Record<string, any>) => {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[query.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[query.className];

        const context = {};

        if (_.isFunction(beforeSave)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage().find({ ...queryOptions(), limit: 1 }))), proto);
          if (!object) return undefined;

          object[PVK].mutated = _.mapValues(_.omit(replacement, ...TObject.defaultReadonlyKeys), v => [UpdateOp.set, v]);
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          replacement = {};
          for (const key of object.keys()) {
            replacement[key] = object.get(key);
          }
        }

        const result = applyObjectMethods(
          await storage().findOneAndReplace(queryOptions(), _.omit(replacement, ...TObject.defaultReadonlyKeys)),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpsert: {
      value: async (update: Record<string, [UpdateOp, any]>, setOnInsert: Record<string, any>) => {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[query.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[query.className];

        const context = {};

        if (_.isFunction(beforeSave)) {

          let object = applyObjectMethods(_.first(await asyncIterableToArray(storage().find({ ...queryOptions(), limit: 1 }))), proto);

          if (object) {
            object[PVK].mutated = _.omit(update, ...TObject.defaultReadonlyKeys);
          } else {
            object = proto.Object(query.className);
            for (const [key, value] of _.toPairs(_.omit(setOnInsert, ...TObject.defaultReadonlyKeys))) {
              object[PVK].mutated[key] = [UpdateOp.set, value];
            }
          }

          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          if (object.objectId) {
            update = object[PVK].mutated;
          } else {
            setOnInsert = {};
            for (const [key, [op, value]] of _.toPairs(object[PVK].mutated)) {
              if (op === UpdateOp.set) {
                setOnInsert[key] = value;
              }
            }
          }
        }

        const result = applyObjectMethods(
          await storage().findOneAndUpsert(
            queryOptions(),
            _.omit(update, ...TObject.defaultReadonlyKeys),
            _.omit(setOnInsert, ...TObject.defaultReadonlyKeys)
          ),
          proto,
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndDelete: {
      value: async () => {
        const beforeDelete = proto[PVK].triggers?.beforeDelete?.[query.className];
        const afterDelete = proto[PVK].triggers?.afterDelete?.[query.className];

        const context = {};
        let result: TObject | undefined;

        if (_.isFunction(beforeDelete)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage().find({ ...queryOptions(), limit: 1 }))), proto);
          if (!object) return undefined;

          await beforeDelete(Object.setPrototypeOf({ object, context }, proto));

          result = applyObjectMethods(
            await storage().findOneAndDelete({
              ...queryOptions(),
              filter: { _id: object.objectId },
            }),
            proto,
          );

        } else {
          result = applyObjectMethods(
            await storage().findOneAndDelete(queryOptions()),
            proto,
          );
        }

        if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findAndDelete: {
      value: async () => {
        const beforeDelete = proto[PVK].triggers?.beforeDelete?.[query.className];
        const afterDelete = proto[PVK].triggers?.afterDelete?.[query.className];

        const context = {};

        if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

          const objects = applyObjectMethods(await asyncIterableToArray(storage().find(queryOptions())), proto);
          if (_.isEmpty(objects)) return 0;

          if (_.isFunction(beforeDelete)) {
            await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({ object, context }, proto))));
          }

          await storage().findAndDelete({
            ...queryOptions(),
            filter: { _id: { $in: _.map(objects, x => x.objectId) } },
          });

          if (_.isFunction(afterDelete)) {
            await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({ object, context }, proto))));
          }

          return objects.length;
        }

        return storage().findAndDelete(queryOptions());
      },
    },
  };

  return Object.defineProperties(query, props);
}
