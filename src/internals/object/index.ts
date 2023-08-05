//
//  object.ts
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
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { TValue, cloneValue, isPrimitiveValue } from '../query/value';
import { TSchema } from '../../server/schema';
import { PathName } from '../query/types';

export const enum UpdateOp {
  set = 'set',
  increment = 'inc',
  decrement = 'dec',
  multiply = 'mul',
  divide = 'div',
  max = 'max',
  min = 'min',
  addToSet = 'addToSet',
  push = 'push',
  removeAll = 'removeAll',
  popFirst = 'popFirst',
  popLast = 'popLast',
}

export interface TObject {
  clone(): TObject;
  fetchWithInclude(keys: string[], options?: ExtraOptions): PromiseLike<this>;
  save(options?: ExtraOptions & { cascadeSave?: boolean }): PromiseLike<this>;
  destory(options?: ExtraOptions): PromiseLike<this>;
}

export class TObject {

  static defaultReadonlyKeys = ['_id', '__v', '_created_at', '_updated_at'];
  static defaultKeys = [...TObject.defaultReadonlyKeys, '_expired_at', '_rperm', '_wperm'];

  [PVK]: {
    className: string;
    attributes: Record<string, TValue>;
    mutated: Record<string, [UpdateOp, TValue]>;
    extra: Record<string, any>;
  };

  constructor(
    className: string,
    attributes?: Record<string, TValue> | ((self: TObject) => Record<string, TValue>),
  ) {
    const _attributes = _.isFunction(attributes) ? attributes(this) : attributes ?? {};
    this[PVK] = {
      className,
      attributes: cloneValue(_attributes),
      mutated: {},
      extra: {},
    }
  }

  get className(): string {
    return this[PVK].className;
  }

  get attributes(): Record<string, TValue> {
    return cloneValue(this[PVK].attributes);
  }

  get objectId(): string | undefined {
    return this[PVK].attributes._id as string;
  }

  get createdAt(): Date | undefined {
    return this[PVK].attributes._created_at as Date;
  }

  get updatedAt(): Date | undefined {
    return this[PVK].attributes._updated_at as Date;
  }

  get version(): string {
    return this[PVK].attributes.__v as string;
  }

  get expiredAt(): Date | undefined {
    return this.get('_expired_at') as Date;
  }

  set expiredAt(value: Date | undefined) {
    this.set('_expired_at', value);
  }

  get acl(): TSchema.ACLs {
    return {
      read: this.get('_rperm') as TSchema.ACL,
      update: this.get('_wperm') as TSchema.ACL,
    };
  }

  set acl(value: TSchema.ACLs) {
    this.set('_rperm', value.read);
    this.set('_wperm', value.update);
  }

  keys(): string[] {
    return _.uniq([..._.keys(this[PVK].attributes), ..._.compact(_.map(_.keys(this[PVK].mutated), x => _.first(_.toPath(x))))]);
  }

  private attrValue(key: string): TValue {
    let value: TValue = this[PVK].attributes;
    for (const k of _.toPath(key)) {
      if (isPrimitiveValue(value)) return null;
      if (value instanceof TObject) {
        value = value.get(k as any);
      } else {
        value = _.get(value, k);
      }
    }
    return cloneValue(value);
  }

  get<T extends string>(key: PathName<T>) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (_.isNil(this[PVK].mutated[key])) return this.attrValue(key);
    const [op, value] = this[PVK].mutated[key];
    return op === UpdateOp.set ? value : this.attrValue(key);
  }

  set<T extends string>(key: PathName<T>, value: TValue | undefined) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.set, value ?? null];
  }

  get isDirty(): boolean {
    return !_.isEmpty(this[PVK].mutated);
  }

  increment<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.increment, value];
  }

  decrement<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.decrement, value];
  }

  multiply<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.multiply, value];
  }

  divide<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.divide, value];
  }

  max<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.max, value];
  }

  min<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.min, value];
  }

  addToSet<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.addToSet, values];
  }

  push<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.push, values];
  }

  removeAll<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.removeAll, values];
  }

  popFirst<T extends string>(key: PathName<T>) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.popFirst, null];
  }

  popLast<T extends string>(key: PathName<T>) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key)) as string)) return;
    this[PVK].mutated[key] = [UpdateOp.popLast, null];
  }

  async fetch(options?: ExtraOptions) {
    return this.fetchWithInclude(_.keys(this[PVK].attributes), options);
  }

  async fetchIfNeeded(keys: string[], options?: ExtraOptions) {
    const current = _.keys(this[PVK].attributes);
    if (_.every(keys, k => _.includes(current, k))) return this;
    return this.fetchWithInclude(_.uniq([...current, ...keys]), options);
  }

}
