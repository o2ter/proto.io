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
import { IOObject } from './index';
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { Query } from '../query';
import { IOSerializable, Proto } from '../../client';
import { IOObjectExtension } from './types';

export const objectMethods = <T extends IOObject | IOObject[] | undefined, E>(
  object: T,
  proto: {
    [PVK]: { options: { classExtends?: IOObjectExtension<E> } };
    query(className: string, options?: ExtraOptions): Query;
  }
): T => {

  if (_.isNil(object)) return undefined as T;
  if (_.isArray(object)) return _.map(object, x => objectMethods(x, proto)) as T;

  const classExtends = proto[PVK].options.classExtends ?? {} as IOObjectExtension<E>;
  const query = (options?: ExtraOptions) => proto.query(object.className, options).filter({ _id: object.objectId });

  const extensions = classExtends[object.className as keyof E] ?? {};

  return Object.defineProperties(object, {
    ..._.mapValues(extensions, value => _.isFunction(value) ? { value } : value),
    save: {
      value: async (options?: ExtraOptions) => {
        const updated = await query(options).findOneAndUpdate(object[PVK].mutated);
        if (updated) {
          object[PVK].attributes = updated.attributes;
          object[PVK].mutated = {};
        }
      },
    },
    destory: {
      value: async (options?: ExtraOptions) => {
        await query(options).findOneAndDelete();
      },
    },
  });
};

export const applyIOObjectMethods = <E>(data: IOSerializable<IOObject>, proto: Proto<E>): IOSerializable<IOObject> => {
  if (data instanceof IOObject) return objectMethods(data, proto);
  if (_.isArray(data)) return _.map(data, x => applyIOObjectMethods(x, proto));
  if (_.isPlainObject(data)) return _.mapValues(data as any, x => applyIOObjectMethods(x, proto));
  return data;
};
