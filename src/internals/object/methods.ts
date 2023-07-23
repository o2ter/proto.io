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
import { TSerializable } from '../codec';
import { TFile } from './file';

export const applyObjectMethods = <T extends TSerializable | undefined, E>(
  object: T,
  proto: ProtoType<E>,
): T => {

  if (!(object instanceof TObject)) {
    if (_.isArray(object)) return _.map(object, x => applyObjectMethods(x, proto)) as T;
    if (_.isPlainObject(object)) return _.mapValues(object as any, x => applyObjectMethods(x, proto));
    return object;
  }

  const classExtends = proto[PVK].options.classExtends ?? {} as TExtensions<E>;
  const extensions = classExtends[object.className as keyof E] ?? {};
  const query = (options?: ExtraOptions) => proto.Query(object.className, options);

  const saveMethods = {
    '_File': (options?: ExtraOptions) => proto[PVK].saveFile(object as TFile, options),
    default: async (options?: ExtraOptions) => {
      if (object.objectId) {
        const updated = await query(options).filter({ _id: object.objectId }).findOneAndUpdate(object[PVK].mutated);
        if (updated) {
          object[PVK].attributes = updated.attributes;
          object[PVK].mutated = {};
        }
      } else {
        const created = await query(options).insert(_.fromPairs(object.keys().map(k => [k, object.get(k)])));
        if (created) {
          object[PVK].attributes = created.attributes;
          object[PVK].mutated = {};
        }
      }
      return object;
    },
  };

  const destoryMethods = {
    '_File': (options?: ExtraOptions) => proto[PVK].deleteFile(object as TFile, options),
    default: async (options?: ExtraOptions) => {
      const deleted = await query(options).filter({ _id: object.objectId }).findOneAndDelete();
      if (deleted) {
        object[PVK].attributes = deleted.attributes;
        object[PVK].mutated = {};
      }
      return object;
    },
  };

  return Object.defineProperties(object, {
    ..._.mapValues(extensions, value => _.isFunction(value) ? { value } : value),
    clone: {
      value: () => {
        const clone = proto.Object(object.className);
        clone[PVK].attributes = { ...object[PVK].attributes };
        clone[PVK].mutated = { ...object[PVK].mutated };
        clone[PVK].extra = { ...object[PVK].extra };
        return clone;
      }
    },
    fetchWithInclude: {
      value: async (keys: string[], options?: ExtraOptions) => {
        const fetched = await query(options).filter({ _id: object.objectId }).includes(...keys).first();
        if (fetched) {
          object[PVK].attributes = fetched.attributes;
          object[PVK].mutated = {};
        }
        return object;
      },
    },
    save: {
      value: saveMethods[object.className as keyof typeof saveMethods] ?? saveMethods.default,
    },
    destory: {
      value: destoryMethods[object.className as keyof typeof destoryMethods] ?? destoryMethods.default,
    }
  });
};
