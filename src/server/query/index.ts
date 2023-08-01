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

  private _proto: Proto<E>;
  private _options?: ExtraOptions;

  constructor(className: T, proto: Proto<E>, options?: ExtraOptions) {
    super(className);
    this._proto = proto;
    this._options = options;
  }

  private get _queryOptions() {
    return {
      className: this.className,
      options: this._options ?? {},
      ...this[PVK].options,
    };
  }

  private get _storage() {
    return queryValidator(this._proto, this.className, this._options);
  }

  explain() {
    return this._storage.explain(this._queryOptions);
  }

  count() {
    return this._storage.count(this._queryOptions);
  }

  clone(options?: TQuery.Options) {
    const clone = new ProtoQuery(this.className, this._proto, this._options);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  private _objectMethods<U extends TObject | TObject[] | undefined>(object: U) {
    return applyObjectMethods(object, this._proto) as TExtended<U, T, E>;
  }

  find() {
    const self = this;
    return asyncStream(async function* () {
      const objects = self._storage.find(self._queryOptions);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  async insert(attrs: Record<string, TValue>) {
    const beforeSave = this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this._proto[PVK].triggers?.afterSave?.[this.className];

    const context = this._options?.context ?? {};

    const object = this._proto.Object(this.className);
    for (const [key, value] of _.toPairs(attrs)) {
      object[PVK].mutated[key] = [UpdateOp.set, value as any];
    }

    if (_.isFunction(beforeSave)) await beforeSave(Object.setPrototypeOf({ object, context }, this._proto));

    const result = this._objectMethods(
      await this._storage.insert(this.className, _.fromPairs(object.keys().map(k => [k, object.get(k)])))
    );
    if (!result) throw Error('Unable to insert document');
    if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this._proto));
    return result;
  }

  async updateOne(update: Record<string, [UpdateOp, TValue]>) {
    const beforeSave = this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this._proto[PVK].triggers?.afterSave?.[this.className];

    const context = this._options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      const object = this._objectMethods(
        _.first(await asyncIterableToArray(this._storage.find({ ...this._queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      object[PVK].mutated = update;
      await beforeSave(Object.setPrototypeOf({ object, context }, this._proto));

      update = object[PVK].mutated;
    }

    const result = this._objectMethods(
      await this._storage.updateOne(this._queryOptions, update)
    );
    if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this._proto));
    return result;
  }

  async replaceOne(replacement: Record<string, TValue>) {
    const beforeSave = this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this._proto[PVK].triggers?.afterSave?.[this.className];

    const context = this._options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      const object = this._objectMethods(
        _.first(await asyncIterableToArray(this._storage.find({ ...this._queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      object[PVK].mutated = _.mapValues(replacement, v => [UpdateOp.set, v]) as any;
      await beforeSave(Object.setPrototypeOf({ object, context }, this._proto));

      replacement = {};
      for (const key of object.keys()) {
        replacement[key] = object.get(key);
      }
    }

    const result = this._objectMethods(
      await this._storage.replaceOne(this._queryOptions, replacement)
    );
    if (result && _.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this._proto));
    return result;
  }

  async upsertOne(update: Record<string, [UpdateOp, TValue]>, setOnInsert: Record<string, TValue>) {
    const beforeSave = this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = this._proto[PVK].triggers?.afterSave?.[this.className];

    const context = this._options?.context ?? {};

    if (_.isFunction(beforeSave)) {

      let object = this._objectMethods(
        _.first(await asyncIterableToArray(this._storage.find({ ...this._queryOptions, limit: 1 })))
      );

      if (object) {
        object[PVK].mutated = update;
      } else {
        object = this._proto.Object(this.className);
        for (const [key, value] of _.toPairs(setOnInsert)) {
          object[PVK].mutated[key] = [UpdateOp.set, value as any];
        }
      }

      await beforeSave(Object.setPrototypeOf({ object, context }, this._proto));

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

    const result = this._objectMethods(
      await this._storage.upsertOne(this._queryOptions, update, setOnInsert)
    );
    if (!result) throw Error('Unable to upsert document');
    if (_.isFunction(afterSave)) await afterSave(Object.setPrototypeOf({ object: result, context }, this._proto));
    return result;
  }

  async deleteOne() {
    const beforeDelete = this._proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = this._proto[PVK].triggers?.afterDelete?.[this.className];

    const context = this._options?.context ?? {};
    let result: TObjectType<T, E> | undefined;

    if (_.isFunction(beforeDelete)) {

      const object = this._objectMethods(
        _.first(await asyncIterableToArray(this._storage.find({ ...this._queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      await beforeDelete(Object.setPrototypeOf({ object, context }, this._proto));

      result = this._objectMethods(
        await this._storage.deleteOne({
          ...this._queryOptions,
          filter: { _id: { $eq: object.objectId } },
        })
      );

    } else {
      result = this._objectMethods(
        await this._storage.deleteOne(this._queryOptions)
      );
    }

    if (result && _.isFunction(afterDelete)) await afterDelete(Object.setPrototypeOf({ object: result, context }, this._proto));
    return result;
  }

  async deleteMany() {
    const beforeDelete = this._proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = this._proto[PVK].triggers?.afterDelete?.[this.className];

    const context = this._options?.context ?? {};

    if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

      const objects = this._objectMethods(await asyncIterableToArray(this._storage.find(this._queryOptions)));
      if (_.isEmpty(objects)) return 0;

      if (_.isFunction(beforeDelete)) {
        await Promise.all(_.map(objects, object => beforeDelete(Object.setPrototypeOf({ object, context }, this._proto))));
      }

      await this._storage.deleteMany({
        ...this._queryOptions,
        filter: { _id: { $in: _.map(objects, x => x.objectId as string) } },
      });

      if (_.isFunction(afterDelete)) {
        await Promise.all(_.map(objects, object => afterDelete(Object.setPrototypeOf({ object, context }, this._proto))));
      }

      return objects.length;
    }

    return this._storage.deleteMany(this._queryOptions);
  }

}