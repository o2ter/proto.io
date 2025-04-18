//
//  methods.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { TObject, decodeUpdateOp } from './index';
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { TExtensions, TObjectType, TObjectTypes } from './types';
import { ProtoType } from '../proto';
import { TSerializable } from '../codec';
import { PathName } from './../query/types';
import { TFile } from './file';
import { isObjKey } from '../utils';

export type TExtended<U, T extends string, E> = U extends TObject ?
  TObjectType<T, E> : U extends (infer U)[] ?
  TExtended<U, T, E>[] : U;

export const applyObjectMethods = <T extends TSerializable, E>(
  object: T,
  proto: ProtoType<E>,
): T => {

  if (!(object instanceof TObject)) {
    if (_.isArray(object)) return _.map(object, x => applyObjectMethods(x, proto)) as T;
    if (_.isPlainObject(object)) return _.mapValues(object as any, x => applyObjectMethods(x, proto));
    return object;
  }

  object[PVK].attributes = _.mapValues(object[PVK].attributes, x => applyObjectMethods(x, proto));

  const className = object.className;
  const _class = isObjKey(className, TObjectTypes) ? TObjectTypes[className] : undefined;
  if (_class && Object.getPrototypeOf(object) !== _class.prototype) {
    Object.setPrototypeOf(object, _class.prototype);
  }

  const classExtends = proto[PVK].options.classExtends ?? {} as TExtensions<E>;
  const extensions = {
    ...classExtends['*' as keyof E] ?? {},
    ...classExtends[className as keyof E] ?? {},
  };
  const query = () => proto.Query(className);

  const typedMethods: Record<string, PropertyDescriptorMap & ThisType<TObject>> = {
    'File': {
      save: {
        value(options?: ExtraOptions<boolean>) {
          return proto[PVK].saveFile(proto, this as TFile, options);
        },
      },
      destroy: {
        value(options?: ExtraOptions<boolean>) {
          return proto[PVK].deleteFile(proto, this as TFile, options);
        },
      },
      url: {
        get() {
          const filename = (this as TFile).filename;
          if (_.isNil(this.id) || _.isNil(filename)) return;
          const endpoint = proto[PVK].options.endpoint;
          const path = `files/${this.id}/${encodeURIComponent(filename)}`;
          return endpoint.endsWith('/') ? `${endpoint}${path}` : `${endpoint}/${path}`;
        }
      },
      fileData: {
        value(options?: ExtraOptions<boolean>) {
          return proto[PVK].fileData(proto, this as TFile, options);
        },
      },
    },
  };

  const props: PropertyDescriptorMap & ThisType<TObject> = {
    clone: {
      value() {
        const clone = proto.Object(this.className);
        clone[PVK].attributes = { ...this[PVK].attributes };
        clone[PVK].mutated = { ...this[PVK].mutated };
        clone[PVK].extra = { ...this[PVK].extra };
        return clone;
      }
    },
    relation: {
      value<T extends string>(key: PathName<T>) {
        return proto.Relation(this, key);
      }
    },
    fetchWithInclude: {
      async value(keys: _.RecursiveArray<string>, options?: ExtraOptions<boolean>) {
        const fetched = await query().equalTo('_id', this.id).includes(keys).first(options);
        if (!fetched) throw Error('Unable to fetch document');
        this[PVK].attributes = fetched.attributes;
        return this;
      },
    },
    save: {
      async value(options?: ExtraOptions<boolean> & { cascadeSave?: boolean }) {
        const mutated = _.values(this[PVK].mutated);
        if (options?.cascadeSave !== false) {
          for (const update of _.values(mutated)) {
            const [, value] = decodeUpdateOp(update);
            if (value instanceof TObject && (_.isNil(value.id) || value.isDirty)) await value.save(options);
          }
        }
        if (this.id) {
          const updated = await query()
            .equalTo('_id', this.id)
            .includes(...this.keys())
            .updateOne(this[PVK].mutated, options);
          if (!updated) throw Error('Unable to save document');
          this[PVK].attributes = updated.attributes;
          this[PVK].mutated = {};
        } else {
          const created = await query()
            .includes(...this.keys())
            .insert(_.fromPairs([...this._set_entries()]), options);
          this[PVK].attributes = created.attributes;
          this[PVK].mutated = {};
        }
        return this;
      },
    },
    destroy: {
      async value(options?: ExtraOptions<boolean>) {
        const deleted = await query()
          .equalTo('_id', this.id)
          .includes(...this.keys())
          .deleteOne(options);
        if (!deleted) throw Error('Unable to destroy document');
        this[PVK].attributes = deleted.attributes;
        this[PVK].mutated = {};
        return this;
      },
    },
    ...typedMethods[className] ?? {},
    ..._.mapValues(extensions, value => _.isFunction(value) ? { value } : value),
  };

  const _props = _.pickBy(props, (_v, k) => !Object.hasOwn(object, k)) as typeof props;
  return Object.defineProperties(object, _props);
};
