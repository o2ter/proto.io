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
  TValue,
} from '../../internals';
import { queryValidator } from './validator';

export const applyQueryMethods = <T extends string, E>(
  query: TQuery<T, E>,
  proto: Proto<E>,
  options?: ExtraOptions,
) => {

  const queryOptions = (query: TQuery<T, E>) => ({
    className: query.className,
    options: options ?? {},
    ...query[PVK].options,
  });

  const storage = (query: TQuery<T, E>) => queryValidator(proto, query.className, options);

  const props: PropertyDescriptorMap & ThisType<TQuery<T, E>> = {
    explain: {
      value() {
        return storage(this).explain(queryOptions(this));
      },
    },
    count: {
      value() {
        return storage(this).count(queryOptions(this));
      },
    },
    find: {
      value() {
        const objects = () => storage(this).find(queryOptions(this));
        const iterator = async function* () {
          for await (const object of objects()) yield applyObjectMethods(object, proto);
        };
        return {
          get then() {
            return asyncIterableToArray({ [Symbol.asyncIterator]: iterator }).then;
          },
          [Symbol.asyncIterator]: iterator,
        };
      },
    },
    insert: {
      async value(attrs: Record<string, TValue>) {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[this.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[this.className];

        const context = options?.context ?? {};

        const object = proto.Object(this.className);
        for (const [key, value] of _.toPairs(attrs)) {
          object[PVK].mutated[key] = [UpdateOp.set, value as any];
        }

        if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object, context }, proto));

        const result = applyObjectMethods(
          await storage(this).insert(this.className, _.fromPairs(object.keys().map(k => [k, object.get(k)]))),
          proto,
        );
        if (!result) throw Error('Unable to insert document');
        if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpdate: {
      async value(update: Record<string, [UpdateOp, TValue]>) {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[this.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[this.className];

        const context = options?.context ?? {};

        if (_.isFunction(beforeSave)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage(this).find({ ...queryOptions(this), limit: 1 }))), proto);
          if (!object) return undefined;

          object[PVK].mutated = update;
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          update = object[PVK].mutated;
        }

        const result = applyObjectMethods(
          await storage(this).findOneAndUpdate(queryOptions(this), update), proto
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndReplace: {
      async value(replacement: Record<string, TValue>) {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[this.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[this.className];

        const context = options?.context ?? {};

        if (_.isFunction(beforeSave)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage(this).find({ ...queryOptions(this), limit: 1 }))), proto);
          if (!object) return undefined;

          object[PVK].mutated = _.mapValues(replacement, v => [UpdateOp.set, v]) as any;
          await beforeSave(Object.setPrototypeOf({ object, context }, proto));

          replacement = {};
          for (const key of object.keys()) {
            replacement[key] = object.get(key);
          }
        }

        const result = applyObjectMethods(
          await storage(this).findOneAndReplace(queryOptions(this), replacement), proto
        );
        if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndUpsert: {
      async value(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
        const beforeSave = proto[PVK].triggers?.beforeSave?.[this.className];
        const afterSave = proto[PVK].triggers?.afterSave?.[this.className];

        const context = options?.context ?? {};

        if (_.isFunction(beforeSave)) {

          let object = applyObjectMethods(_.first(await asyncIterableToArray(storage(this).find({ ...queryOptions(this), limit: 1 }))), proto);

          if (object) {
            object[PVK].mutated = update;
          } else {
            object = proto.Object(this.className);
            for (const [key, value] of _.toPairs(setOnInsert)) {
              object[PVK].mutated[key] = [UpdateOp.set, value as any];
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
          await storage(this).findOneAndUpsert(queryOptions(this), update, setOnInsert), proto
        );
        if (!result) throw Error('Unable to upsert document');
        if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findOneAndDelete: {
      async value() {
        const beforeDelete = proto[PVK].triggers?.beforeDelete?.[this.className];
        const afterDelete = proto[PVK].triggers?.afterDelete?.[this.className];

        const context = options?.context ?? {};
        let result: TObject | undefined;

        if (_.isFunction(beforeDelete)) {

          const object = applyObjectMethods(_.first(await asyncIterableToArray(storage(this).find({ ...queryOptions(this), limit: 1 }))), proto);
          if (!object) return undefined;

          await beforeDelete(Object.setPrototypeOf({ object, context }, proto));

          result = applyObjectMethods(
            await storage(this).findOneAndDelete({
              ...queryOptions(this),
              filter: { _id: { $eq: object.objectId } },
            }),
            proto,
          );

        } else {
          result = applyObjectMethods(
            await storage(this).findOneAndDelete(queryOptions(this)),
            proto,
          );
        }

        if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result, context }, proto));
        return result;
      },
    },
    findAndDelete: {
      async value() {
        const beforeDelete = proto[PVK].triggers?.beforeDelete?.[this.className];
        const afterDelete = proto[PVK].triggers?.afterDelete?.[this.className];

        const context = options?.context ?? {};

        if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

          const objects = applyObjectMethods(await asyncIterableToArray(storage(this).find(queryOptions(this))), proto);
          if (_.isEmpty(objects)) return 0;

          if (_.isFunction(beforeDelete)) {
            await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({ object, context }, proto))));
          }

          await storage(this).findAndDelete({
            ...queryOptions(this),
            filter: { _id: { $in: _.map(objects, x => x.objectId as string) } },
          });

          if (_.isFunction(afterDelete)) {
            await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({ object, context }, proto))));
          }

          return objects.length;
        }

        return storage(this).findAndDelete(queryOptions(this));
      },
    },
  };

  return Object.defineProperties(query, props);
}
