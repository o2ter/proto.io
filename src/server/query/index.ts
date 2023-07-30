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
  asyncStream,
  TExtended,
  TObjectType,
} from '../../internals';
import { queryValidator } from './validator';

export class ProtoQuery<T extends string, E> extends TQuery<T, E> {

  #proto: Proto<E>;
  #options?: ExtraOptions;

  constructor(className: T, proto: Proto<E>, options?: ExtraOptions) {
    super(className);
    this.#proto = proto;
    this.#options = options;
  }

  get #queryOptions() {
    return {
      className: this.className,
      options: this.#options ?? {},
      ...this[PVK].options,
    };
  }

  get #storage() {
    return queryValidator(this.#proto, this.className, this.#options);
  }

  explain() {
    return this.#storage.explain(this.#queryOptions);
  }

  count() {
    return this.#storage.count(this.#queryOptions);
  }

  clone(options?: TQuery.Options) {
    const clone = new ProtoQuery(this.className, this.#proto, this.#options);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  #objectMethods<U extends TObject | TObject[] | undefined>(object: U) {
    return applyObjectMethods(object, this.#proto) as TExtended<U, T, E>;
  }

  find() {
    const self = this;
    return asyncStream(async function* () {
      const objects = self.#storage.find(self.#queryOptions);
      for await (const object of objects) yield self.#objectMethods(object);
    });
  }

  async insert(attrs: Record<string, TValue>) {
    const beforeSave = this.#proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this.#proto[PVK].triggers?.afterSave?.[this.className];

    const context = this.#options?.context ?? {};

    const object = this.#proto.Object(this.className);
    for (const [key, value] of _.toPairs(attrs)) {
      object[PVK].mutated[key] = [UpdateOp.set, value as any];
    }

    if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object, context }, this.#proto));

    const result = this.#objectMethods(
      await this.#storage.insert(this.className, _.fromPairs(object.keys().map(k => [k, object.get(k)])))
    );
    if (!result) throw Error('Unable to insert document');
    if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this.#proto));
    return result;
  }

  async findOneAndUpdate(update: Record<string, [UpdateOp, TValue]>) {
    const beforeSave = this.#proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this.#proto[PVK].triggers?.afterSave?.[this.className];

    const context = this.#options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      const object = this.#objectMethods(
        _.first(await asyncIterableToArray(this.#storage.find({ ...this.#queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      object[PVK].mutated = update;
      await beforeSave(Object.setPrototypeOf({ object, context }, this.#proto));

      update = object[PVK].mutated;
    }

    const result = this.#objectMethods(
      await this.#storage.findOneAndUpdate(this.#queryOptions, update)
    );
    if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this.#proto));
    return result;
  }

  async findOneAndReplace(replacement: Record<string, TValue>) {
    const beforeSave = this.#proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this.#proto[PVK].triggers?.afterSave?.[this.className];

    const context = this.#options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      const object = this.#objectMethods(
        _.first(await asyncIterableToArray(this.#storage.find({ ...this.#queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      object[PVK].mutated = _.mapValues(replacement, v => [UpdateOp.set, v]) as any;
      await beforeSave(Object.setPrototypeOf({ object, context }, this.#proto));

      replacement = {};
      for (const key of object.keys()) {
        replacement[key] = object.get(key);
      }
    }

    const result = this.#objectMethods(
      await this.#storage.findOneAndReplace(this.#queryOptions, replacement)
    );
    if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this.#proto));
    return result;
  }

  async findOneAndUpsert(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    const beforeSave = this.#proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this.#proto[PVK].triggers?.afterSave?.[this.className];

    const context = this.#options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      let object = this.#objectMethods(
        _.first(await asyncIterableToArray(this.#storage.find({ ...this.#queryOptions, limit: 1 })))
      );

      if (object) {
        object[PVK].mutated = update;
      } else {
        object = this.#proto.Object(this.className);
        for (const [key, value] of _.toPairs(setOnInsert)) {
          object[PVK].mutated[key] = [UpdateOp.set, value as any];
        }
      }

      await beforeSave(Object.setPrototypeOf({ object, context }, this.#proto));

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

    const result = this.#objectMethods(
      await this.#storage.findOneAndUpsert(this.#queryOptions, update, setOnInsert)
    );
    if (!result) throw Error('Unable to upsert document');
    if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this.#proto));
    return result;
  }

  async findOneAndDelete() {
    const beforeDelete = this.#proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = this.#proto[PVK].triggers?.afterDelete?.[this.className];

    const context = this.#options?.context ?? {};
    let result: TObjectType<T, E> | undefined;

    if (_.isFunction(beforeDelete)) {

      const object = this.#objectMethods(
        _.first(await asyncIterableToArray(this.#storage.find({ ...this.#queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      await beforeDelete(Object.setPrototypeOf({ object, context }, this.#proto));

      result = this.#objectMethods(
        await this.#storage.findOneAndDelete({
          ...this.#queryOptions,
          filter: { _id: { $eq: object.objectId } },
        })
      );

    } else {
      result = this.#objectMethods(
        await this.#storage.findOneAndDelete(this.#queryOptions)
      );
    }

    if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result, context }, this.#proto));
    return result;
  }

  async findAndDelete() {
    const beforeDelete = this.#proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = this.#proto[PVK].triggers?.afterDelete?.[this.className];

    const context = this.#options?.context ?? {};

    if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

      const objects = this.#objectMethods(await asyncIterableToArray(this.#storage.find(this.#queryOptions)));
      if (_.isEmpty(objects)) return 0;

      if (_.isFunction(beforeDelete)) {
        await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({ object, context }, this.#proto))));
      }

      await this.#storage.findAndDelete({
        ...this.#queryOptions,
        filter: { _id: { $in: _.map(objects, x => x.objectId as string) } },
      });

      if (_.isFunction(afterDelete)) {
        await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({ object, context }, this.#proto))));
      }

      return objects.length;
    }

    return this.#storage.findAndDelete(this.#queryOptions);
  }

}