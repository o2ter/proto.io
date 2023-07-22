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
import { TObject } from './index';
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { TExtensions } from './types';
import { ProtoType } from '../proto';
import { TSerializable } from '../../codec';

export const objectMethods = <T extends TObject | TObject[] | undefined, E>(object: T, proto: ProtoType<E>): T => {

  if (_.isNil(object)) return undefined as T;
  if (_.isArray(object)) return _.map(object, x => objectMethods(x, proto)) as T;

  const classExtends = proto[PVK].options.classExtends ?? {} as TExtensions<E>;
  const extensions = classExtends[object.className as keyof E] ?? {};
  const query = (options?: ExtraOptions) => proto.Query(object.className, options).filter({ _id: object.objectId });

  const ownKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(object));

  return Object.defineProperties(object, {
    ..._.mapValues(extensions, value => _.isFunction(value) ? { value } : value),
    fetchWithInclude: {
      value: async (keys: string[], options?: ExtraOptions) => {
        const fetched = await query(options).includes(...keys).first();
        if (fetched) {
          object[PVK].attributes = fetched.attributes;
          object[PVK].mutated = {};
        }
        return object;
      },
    },
    save: {
      value: async (options?: ExtraOptions) => {
        const updated = await query(options).findOneAndUpdate(object[PVK].mutated);
        if (updated) {
          object[PVK].attributes = updated.attributes;
          object[PVK].mutated = {};
        }
        return object;
      },
    },
    destory: {
      value: async (options?: ExtraOptions) => {
        const deleted = await query(options).findOneAndDelete();
        if (deleted) {
          object[PVK].attributes = deleted.attributes;
          object[PVK].mutated = {};
        }
        return object;
      },
    }
  });
};

export const applyIOObjectMethods = <E>(data: TSerializable, proto: ProtoType<E>): TSerializable => {
  if (data instanceof TObject) return objectMethods(data, proto);
  if (_.isArray(data)) return _.map(data, x => applyIOObjectMethods(x, proto));
  if (_.isPlainObject(data)) return _.mapValues(data as any, x => applyIOObjectMethods(x, proto));
  return data;
};
