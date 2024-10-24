//
//  object.ts
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
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { Decimal } from 'decimal.js';
import { TPrimitiveValue, TValue, _TValue } from '../types';
import { TSchema, defaultObjectKeys, defaultObjectReadonlyKeys } from '../schema';
import { PathName } from '../query/types';
import { TUpdateOp, TUpdateOpKeys } from './types';
import { ProtoType } from '../proto';

export const isPrimitiveValue = (x: any): x is TPrimitiveValue => {
  if (_.isNil(x) || _.isNumber(x) || _.isBoolean(x) || _.isString(x) || _.isDate(x)) return true;
  if (x instanceof Decimal) return true;
  return false;
}

export const isValue = (x: any): x is TValue => {
  if (isPrimitiveValue(x) || x instanceof TObject) return true;
  if (_.isArray(x)) return _.every(x, v => isValue(v));
  if (_.isPlainObject(x)) return _.every(x, v => isValue(v));
  return false;
}

export const cloneValue = <T extends TValue>(x: T): T => {
  if (isPrimitiveValue(x) || x instanceof TObject) return x;
  if (_.isArray(x)) return x.map(v => cloneValue(v)) as T;
  return _.mapValues(x, v => cloneValue(v)) as T;
}

export const _decodeValue = (value: _TValue): _TValue => {
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _decodeValue(x));
  if (_.isString(value.$date)) return new Date(value.$date);
  if (_.isString(value.$decimal)) return new Decimal(value.$decimal);
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = _decodeValue(v);
  }, {} as any);
};

export const _encodeValue = (value: TValue): _TValue => {
  if (value instanceof TObject) throw Error('Invalid data type');
  if (_.isDate(value)) return { $date: value.toISOString() };
  if (value instanceof Decimal) return { $decimal: value.toString() };
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _encodeValue(x));
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? `$${k}` : k] = _encodeValue(v);
  }, {} as any);
};

export const decodeUpdateOp = (update: TUpdateOp) => {
  const pairs = _.toPairs(update);
  if (pairs.length !== 1) throw Error('Invalid update operation');
  return pairs[0] as [typeof TUpdateOpKeys[number], TValue];
}

export interface TObject {
  clone(): TObject;
  fetchWithInclude(keys: string[], options?: ExtraOptions<boolean, ProtoType<any>>): PromiseLike<this>;
  save(options?: ExtraOptions<boolean, ProtoType<any>> & { cascadeSave?: boolean }): PromiseLike<this>;
  destroy(options?: ExtraOptions<boolean, ProtoType<any>>): PromiseLike<this>;
}

export class TObject {

  static defaultReadonlyKeys = defaultObjectReadonlyKeys;
  static defaultKeys = defaultObjectKeys;

  /** @internal */
  [PVK]: {
    className: string;
    attributes: Record<string, TValue>;
    mutated: Record<string, TUpdateOp>;
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

  get __v(): number {
    return this[PVK].attributes.__v as number;
  }

  get __i(): number {
    return this[PVK].attributes.__i as number;
  }

  get expiredAt(): Date | undefined {
    return this.get('_expired_at');
  }

  set expiredAt(value: Date | undefined) {
    this.set('_expired_at', value);
  }

  acl(): TSchema.ACLs {
    return {
      read: this.get('_rperm') ?? ['*'],
      update: this.get('_wperm') ?? ['*'],
    };
  }

  setAcl(value: Partial<TSchema.ACLs>) {
    this.set('_rperm', value.read ?? ['*']);
    this.set('_wperm', value.update ?? ['*']);
  }

  setReadAcl(value: TSchema.ACL) {
    this.set('_rperm', value);
  }

  setWriteAcl(value: TSchema.ACL) {
    this.set('_wperm', value);
  }

  keys(): string[] {
    return _.uniq([..._.keys(this[PVK].attributes), ..._.compact(_.map(_.keys(this[PVK].mutated), x => _.first(_.toPath(x))))]);
  }

  *entries() {
    for (const key of this.keys()) {
      yield [key, this.get(key)] as [string, any];
    }
  }

  /** @internal */
  *_set_entries() {
    for (const [key, op] of _.entries(this[PVK].mutated)) {
      for (const [_op, value] of _.entries(op)) {
        if (_op === '$set') yield [key, value] as [string, any];
      }
    }
  }

  toObject() {
    const toObject = (value: TValue): _TValue => {
      if (isPrimitiveValue(value)) return value;
      if (value instanceof TObject) return value.toObject();
      if (_.isArray(value)) return _.map(value, toObject);
      return _.mapValues(value, toObject);
    }
    return _.fromPairs(_.map(this.keys(), k => [k, toObject(this.get(k))]));
  }

  private _value(key: string): TValue {
    let value: TValue = this[PVK].attributes;
    for (const k of _.toPath(key)) {
      if (isPrimitiveValue(value)) return null;
      if (value instanceof TObject) {
        value = value.get(k);
      } else {
        value = _.get(value, k);
      }
    }
    return cloneValue(value);
  }

  get<T extends string>(key: PathName<T>): any {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (_.isNil(this[PVK].mutated[key])) return this._value(key);
    const [op, value] = decodeUpdateOp(this[PVK].mutated[key]);
    return op === '$set' ? value : this._value(key);
  }

  set<T extends string>(key: PathName<T>, value: TValue | undefined) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $set: value ?? null };
  }

  get isDirty(): boolean {
    return !_.isEmpty(this[PVK].mutated);
  }

  increment<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $inc: value };
  }

  decrement<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $dec: value };
  }

  multiply<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $mul: value };
  }

  divide<T extends string>(key: PathName<T>, value: number) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $div: value };
  }

  max<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $max: value };
  }

  min<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $min: value };
  }

  addToSet<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $addToSet: values };
  }

  push<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $push: values };
  }

  removeAll<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $removeAll: values };
  }

  popFirst<T extends string>(key: PathName<T>, count = 1) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $popFirst: count };
  }

  popLast<T extends string>(key: PathName<T>, count = 1) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $popLast: count };
  }

  async fetch(options?: ExtraOptions<boolean, any>) {
    return this.fetchWithInclude(_.keys(this[PVK].attributes), options);
  }

  async fetchIfNeeded(keys: string[], options?: ExtraOptions<boolean, any>) {
    const current = _.keys(this[PVK].attributes);
    if (_.every(keys, k => _.includes(current, k))) return this;
    return this.fetchWithInclude(_.uniq([...current, ...keys]), options);
  }

}
