//
//  methods.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { ProtoService } from '../proto/index';
import { dispatcher } from './dispatcher';
import { proxy } from '../proto/proxy';
import { asyncIterableToArray, asyncStream } from '@o2ter/utils-js';
import { PVK } from '../../internals/private';
import { ExtraOptions } from '../../internals/options';
import { TQuery, TQueryOptions, TQueryRandomOptions } from '../../internals/query';
import { TObject, decodeUpdateOp } from '../../internals/object';
import { TExtended } from '../../internals/object/methods';
import { TValue } from '../../internals/types';
import { TObjectType, TUpdateOp } from '../../internals/object/types';

export class ProtoQuery<T extends string, E, M extends boolean> extends TQuery<T, E, M, ProtoService<E>> {

  protected _proto: ProtoService<E>;

  constructor(className: T, proto: ProtoService<E>) {
    super(className);
    this._proto = proto;
  }

  private get _queryOptions() {
    return {
      className: this.className,
      ...this[PVK].options,
    };
  }

  private _dispatcher(
    options?: ExtraOptions<M, ProtoService<E>>
  ): ReturnType<typeof dispatcher<E>> {
    if (this instanceof InsecureProtoQuery) {
      if (options?.master !== true) throw Error('No permission');
    }
    return dispatcher(
      options?.session ?? this._proto,
      options ?? {},
      this instanceof InsecureProtoQuery
    );
  }

  explain(options?: ExtraOptions<M, ProtoService<E>>) {
    return this._dispatcher(options).explain(this._queryOptions);
  }

  count(options?: ExtraOptions<M, ProtoService<E>>) {
    return this._dispatcher(options).count(this._queryOptions);
  }

  clone(options?: TQueryOptions) {
    const clone = new ProtoQuery(this.className, this._proto);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }

  private _objectMethods<U extends TObject | TObject[] | undefined>(object: U) {
    return this._proto.rebind(object) as TExtended<U, T, E>;
  }

  find(options?: ExtraOptions<M, ProtoService<E>>) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).find(self._queryOptions);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  nonrefs(options?: ExtraOptions<M, ProtoService<E>>) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).nonrefs(self._queryOptions);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  random(
    opts?: TQueryRandomOptions,
    options?: ExtraOptions<M, ProtoService<E>>
  ) {
    const self = this;
    return asyncStream(async function* () {
      const objects = await self._dispatcher(options).random(self._queryOptions, opts);
      for await (const object of objects) yield self._objectMethods(object);
    });
  }

  async insert(
    attrs: Record<string, TValue>,
    options?: ExtraOptions<M, ProtoService<E>>
  ) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeSave = _.includes(silent, 'beforeSave') ? null : this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = _.includes(silent, 'afterSave') ? null : this._proto[PVK].triggers?.afterSave?.[this.className];

    const object = this._proto.Object(this.className);
    for (const [key, value] of _.toPairs(attrs)) {
      object[PVK].mutated[key] = { $set: value };
    }

    if (_.isFunction(beforeSave)) await beforeSave(
      proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))
    );

    const result = this._objectMethods(
      await this._dispatcher(options).insert({
        className: this.className,
        includes: this[PVK].options.includes,
        matches: this[PVK].options.matches,
      }, _.fromPairs([...object._set_entries()]))
    );
    if (!result) throw Error('Unable to insert document');

    if (_.isFunction(afterSave)) {
      await afterSave(
        proxy(Object.setPrototypeOf({ object: result, context }, options?.session ?? this._proto))
      );
    }
    return result;
  }

  async insertMany(
    values: Record<string, TValue>[],
    options?: ExtraOptions<M, ProtoService<E>>
  ) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeSave = _.includes(silent, 'beforeSave') ? null : this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = _.includes(silent, 'afterSave') ? null : this._proto[PVK].triggers?.afterSave?.[this.className];

    if (_.isFunction(beforeSave) || _.isFunction(afterSave)) {

      const objects = _.map(values, attr => {
        const object = this._proto.Object(this.className);
        for (const [key, value] of _.toPairs(attr)) {
          object[PVK].mutated[key] = { $set: value };
        }
        return object;
      });
      if (_.isEmpty(objects)) return 0;

      if (_.isFunction(beforeSave)) {
        await Promise.all(_.map(objects, object => beforeSave(
          proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))))
        );
      }

      await this._dispatcher(options).insertMany({
        className: this.className,
        includes: this[PVK].options.includes,
        matches: this[PVK].options.matches,
      }, _.map(objects, x => _.fromPairs([...x._set_entries()])));

      if (_.isFunction(afterSave)) {
        await Promise.all(_.map(objects, object => afterSave(
          proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))))
        );
      }

      return objects.length;
    }

    return this._dispatcher(options).insertMany({
      className: this.className,
      includes: this[PVK].options.includes,
      matches: this[PVK].options.matches,
    }, values);
  }

  async updateOne(
    update: Record<string, TUpdateOp>,
    options?: ExtraOptions<M, ProtoService<E>>
  ) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeSave = _.includes(silent, 'beforeSave') ? null : this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = _.includes(silent, 'afterSave') ? null : this._proto[PVK].triggers?.afterSave?.[this.className];

    if (_.isFunction(beforeSave)) {

      const object = this._objectMethods(
        _.first(await asyncIterableToArray(this._dispatcher(options).find({ ...this._queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      object[PVK].mutated = update;
      await beforeSave(
        proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))
      );

      update = object[PVK].mutated;
    }

    const result = this._objectMethods(
      await this._dispatcher(options).updateOne(this._queryOptions, update)
    );

    if (result && _.isFunction(afterSave)) {
      await afterSave(
        proxy(Object.setPrototypeOf({ object: result, context }, options?.session ?? this._proto))
      );
    }

    return result;
  }

  async upsertOne(
    update: Record<string, TUpdateOp>,
    setOnInsert: Record<string, TValue>,
    options?: ExtraOptions<M, ProtoService<E>>
  ) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeSave = _.includes(silent, 'beforeSave') ? null : this._proto[PVK].triggers?.beforeSave?.[this.className];
    const afterSave = _.includes(silent, 'afterSave') ? null : this._proto[PVK].triggers?.afterSave?.[this.className];

    if (_.isFunction(beforeSave)) {

      let object = this._objectMethods(
        _.first(await asyncIterableToArray(this._dispatcher(options).find({ ...this._queryOptions, limit: 1 })))
      );

      if (object) {
        object[PVK].mutated = update;
      } else {
        object = this._proto.Object(this.className);
        for (const [key, value] of _.toPairs(setOnInsert)) {
          object[PVK].mutated[key] = { $set: value };
        }
      }

      await beforeSave(
        proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))
      );

      if (object.objectId) {
        update = object[PVK].mutated;
      } else {
        setOnInsert = {};
        for (const [key, update] of _.toPairs(object[PVK].mutated)) {
          const [op, value] = decodeUpdateOp(update);
          if (op === '$set') {
            setOnInsert[key] = value;
          }
        }
      }
    }

    const result = this._objectMethods(
      await this._dispatcher(options).upsertOne(this._queryOptions, update, setOnInsert)
    );
    if (!result) throw Error('Unable to upsert document');

    if (_.isFunction(afterSave)) {
      await afterSave(
        proxy(Object.setPrototypeOf({ object: result, context }, options?.session ?? this._proto))
      );
    }
    return result;
  }

  async deleteOne(options?: ExtraOptions<M, ProtoService<E>>) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeDelete = _.includes(silent, 'beforeDelete') ? null : this._proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = _.includes(silent, 'afterDelete') ? null : this._proto[PVK].triggers?.afterDelete?.[this.className];

    let result: TObjectType<T, E> | undefined;

    if (_.isFunction(beforeDelete)) {

      const object = this._objectMethods(
        _.first(await asyncIterableToArray(this._dispatcher(options).find({ ...this._queryOptions, limit: 1 })))
      );
      if (!object) return undefined;

      await beforeDelete(
        proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))
      );

      result = this._objectMethods(
        await this._dispatcher(options).deleteOne({
          ...this._queryOptions,
          filter: { _id: { $eq: object.objectId } },
        })
      );

    } else {
      result = this._objectMethods(
        await this._dispatcher(options).deleteOne(this._queryOptions)
      );
    }

    if (result && _.isFunction(afterDelete)) {
      await afterDelete(
        proxy(Object.setPrototypeOf({ object: result, context }, options?.session ?? this._proto))
      );
    }
    return result;
  }

  async deleteMany(options?: ExtraOptions<M, ProtoService<E>>) {
    const context = options?.context ?? {};
    const silent = _.castArray(options?.silent ?? []);

    const beforeDelete = _.includes(silent, 'beforeDelete') ? null : this._proto[PVK].triggers?.beforeDelete?.[this.className];
    const afterDelete = _.includes(silent, 'afterDelete') ? null : this._proto[PVK].triggers?.afterDelete?.[this.className];

    if (_.isFunction(beforeDelete) || _.isFunction(afterDelete)) {

      const objects = this._objectMethods(await asyncIterableToArray(this._dispatcher(options).find(this._queryOptions)));
      if (_.isEmpty(objects)) return 0;

      if (_.isFunction(beforeDelete)) {
        await Promise.all(_.map(objects, object => beforeDelete(
          proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))))
        );
      }

      await this._dispatcher(options).deleteMany({
        ...this._queryOptions,
        filter: { _id: { $in: _.map(objects, x => x.objectId!) } },
      });

      if (_.isFunction(afterDelete)) {
        await Promise.all(_.map(objects, object => afterDelete(
          proxy(Object.setPrototypeOf({ object, context }, options?.session ?? this._proto))))
        );
      }

      return objects.length;
    }

    return this._dispatcher(options).deleteMany(this._queryOptions);
  }

}

export class InsecureProtoQuery<T extends string, E> extends ProtoQuery<T, E, true> {

  clone(options?: TQueryOptions) {
    const clone = new InsecureProtoQuery(this.className, this._proto);
    clone[PVK].options = options ?? { ...this[PVK].options };
    return clone;
  }
}
