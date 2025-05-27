//
//  object.ts
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
import { PVK } from '../private';
import { ExtraOptions } from '../options';
import { Decimal } from 'decimal.js';
import { TPrimitiveValue, TValue, TValueWithoutObject, TValueWithUndefined } from '../types';
import { TSchema, defaultObjectKeys, defaultObjectReadonlyKeys } from '../schema';
import { IncludePaths, PathName } from '../query/types';
import { TUpdateOp, TUpdateOpKeys } from './types';
import { TQuery } from '../query';

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

export const _decodeValue = (value: TValueWithoutObject): TValueWithoutObject => {
  if (isPrimitiveValue(value)) return value;
  if (_.isArray(value)) return _.map(value, x => _decodeValue(x));
  if (_.isString(value.$date)) return new Date(value.$date);
  if (_.isString(value.$decimal)) return new Decimal(value.$decimal);
  return _.transform(value, (r, v, k) => {
    r[k.startsWith('$') ? k.substring(1) : k] = _decodeValue(v);
  }, {} as any);
};

export const _encodeValue = (value: TValueWithUndefined): TValueWithoutObject => {
  if (_.isNil(value)) return value ?? null;
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

/**
 * Interface representing a object.
 */
export interface TObject {
  /**
   * Clones the object.
   * @returns A clone of the object.
   */
  clone(): this;

  /**
   * Gets a relation query for the specified key.
   * @param key - The key of the relation.
   * @returns A query object for the relation.
   */
  relation<T extends string>(key: PathName<T>): TQuery<string, any, boolean>;

  /**
   * Fetches the object with the specified keys included.
   * @param keys - The keys to include.
   * @param options - Additional options for the fetch operation.
   * @returns A promise that resolves to the fetched object.
   */
  fetchWithInclude<T extends _.RecursiveArray<string>>(keys: IncludePaths<T>, options?: ExtraOptions<boolean>): PromiseLike<this>;

  /**
   * Saves the object.
   * @param options - Additional options for the save operation.
   * @returns A promise that resolves to the saved object.
   */
  save(options?: ExtraOptions<boolean> & { cascadeSave?: boolean }): PromiseLike<this>;

  /**
   * Destroys the object.
   * @param options - Additional options for the destroy operation.
   * @returns A promise that resolves to the destroyed object.
   */
  destroy(options?: ExtraOptions<boolean>): PromiseLike<this>;
}

/**
 * Class representing a object.
 */
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

  /**
   * Gets the class name of the object.
   */
  get className(): string {
    return this[PVK].className;
  }

  /**
   * Gets the attributes of the object.
   */
  get attributes(): Record<string, TValue> {
    return cloneValue(this[PVK].attributes);
  }

  /**
   * Gets the object ID.
   */
  get id(): string | undefined {
    return this[PVK].attributes._id as string;
  }

  /**
   * Gets the creation date of the object.
   */
  get createdAt(): Date | undefined {
    return this[PVK].attributes._created_at as Date;
  }

  /**
   * Gets the last updated date of the object.
   */
  get updatedAt(): Date | undefined {
    return this[PVK].attributes._updated_at as Date;
  }

  /**
   * Gets the version number of the object.
   */
  get __v(): number {
    return this[PVK].attributes.__v as number;
  }

  /**
   * Gets the sequence number of the object.
   */
  get __i(): number {
    return this[PVK].attributes.__i as number;
  }

  /**
   * Gets the expiration date of the object.
   */
  get expiredAt(): Date | undefined {
    return this.get('_expired_at');
  }

  /**
   * Sets the expiration date of the object.
   * @param value - The expiration date.
   */
  set expiredAt(value: Date | undefined) {
    this.set('_expired_at', value);
  }

  /**
   * Gets the access control list (ACL) of the object.
   * @returns The ACL of the object.
   */
  acl(): TSchema.ACLs {
    return {
      read: this.get('_rperm') ?? ['*'],
      update: this.get('_wperm') ?? ['*'],
    };
  }

  /**
   * Sets the access control list (ACL) of the object.
   * @param value - The ACL to set.
   */
  setAcl(value: Partial<TSchema.ACLs>) {
    this.set('_rperm', value.read ?? ['*']);
    this.set('_wperm', value.update ?? ['*']);
  }

  /**
   * Sets the read access control list (ACL) of the object.
   * @param value - The read ACL to set.
   */
  setReadAcl(value: TSchema.ACL) {
    this.set('_rperm', value);
  }

  /**
   * Sets the write access control list (ACL) of the object.
   * @param value - The write ACL to set.
   */
  setWriteAcl(value: TSchema.ACL) {
    this.set('_wperm', value);
  }

  /**
   * Gets the keys of the object's attributes and mutated attributes.
   * @returns An array of keys.
   */
  keys(): string[] {
    return _.uniq([..._.keys(this[PVK].attributes), ..._.compact(_.map(_.keys(this[PVK].mutated), x => _.first(_.toPath(x))))]);
  }

  /**
   * Gets an iterator for the entries of the object's attributes.
   * @returns An iterator for the entries.
   */
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

  /**
   * Converts the object to a plain object.
   * @param replacer - An optional function to replace values during the conversion.
   * @returns The plain object representation of the object.
   */
  toObject(replacer?: (value: TObject) => any): any {
    const toObject = (value: TValue): any => {
      if (isPrimitiveValue(value)) return value;
      if (value instanceof TObject) return replacer?.(value) ?? value.toObject(replacer);
      if (_.isArray(value)) return _.map(value, toObject);
      return _.mapValues(value, toObject);
    };
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

  /**
   * Get the value of the attribute.
   * @param key - The key of the attribute.
   * @returns The value of the attribute.
   */
  get<T extends string>(key: PathName<T>): any {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (_.isNil(this[PVK].mutated[key])) return this._value(key);
    const [op, value] = decodeUpdateOp(this[PVK].mutated[key]);
    return op === '$set' ? value : this._value(key);
  }

  /**
   * Set the value of the attribute.
   * @param key - The key of the attribute.
   * @param value - The value to set.
   */
  set<T extends string>(key: PathName<T>, value: TValueWithUndefined) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $set: value ?? null };
  }

  /**
   * Is the object dirty.
   */
  get isDirty(): boolean {
    return !_.isEmpty(this[PVK].mutated);
  }

  /**
   * Increment the value of the attribute.
   * @param key - The key to increment.
   * @param value - The value to increment by.
   */
  increment<T extends string>(key: PathName<T>, value: number | Decimal) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $inc: value };
  }

  /**
   * Decrement the value of the attribute.
   * @param key - The key to decrement.
   * @param value - The value to decrement by.
   */
  decrement<T extends string>(key: PathName<T>, value: number | Decimal) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $dec: value };
  }

  /**
   * Multiplies the value of the specified attribute.
   * @param key - The key of the attribute to multiply.
   * @param value - The multiplier value.
   */
  multiply<T extends string>(key: PathName<T>, value: number | Decimal) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $mul: value };
  }

  /**
   * Divides the value of the specified attribute.
   * @param key - The key of the attribute to divide.
   * @param value - The divisor value.
   */
  divide<T extends string>(key: PathName<T>, value: number | Decimal) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $div: value };
  }

  /**
   * Sets the value of the specified attribute to the maximum of the current value and the provided value.
   * @param key - The key of the attribute to compare.
   * @param value - The value to compare against.
   */
  max<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $max: value };
  }

  /**
   * Sets the value of the specified attribute to the minimum of the current value and the provided value.
   * @param key - The key of the attribute to compare.
   * @param value - The value to compare against.
   */
  min<T extends string>(key: PathName<T>, value: TValue) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $min: value };
  }

  /**
   * Adds the specified values to the set of the specified attribute.
   * @param key - The key of the attribute.
   * @param values - The values to add to the set.
   */
  addToSet<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $addToSet: values };
  }

  /**
   * Adds the values to the array of the attribute.
   * @param key - The key of the attribute.
   * @param values - The values to add.
   */
  push<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $push: values };
  }

  /**
   * Removes the values from the array of the attribute.
   * @param key - The key of the attribute.
   * @param values - The values to remove.
   */
  removeAll<T extends string>(key: PathName<T>, values: TValue[]) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $removeAll: values };
  }

  /**
   * Removes the first elements from the array of the attribute.
   * @param key - The key of the attribute.
   * @param count - The number of elements to remove. Defaults to 1.
   */
  popFirst<T extends string>(key: PathName<T>, count = 1) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $popFirst: count };
  }

  /**
   * Removes the last elements from the array of the attribute.
   * @param key - The key of the attribute.
   * @param count - The number of elements to remove. Defaults to 1.
   */
  popLast<T extends string>(key: PathName<T>, count = 1) {
    if (_.isEmpty(key)) throw Error('Invalid key');
    if (TObject.defaultReadonlyKeys.includes(_.first(_.toPath(key))!)) return;
    this[PVK].mutated[key] = { $popLast: count };
  }

  /**
   * Fetches the object data.
   * @param options - Additional options for the fetch operation.
   * @returns A promise that resolves to the fetched object.
   */
  async fetch(options?: ExtraOptions<boolean>) {
    return this.fetchWithInclude(_.keys(this[PVK].attributes), options);
  }

  /**
   * Fetches the object data if needed.
   * @param keys - The keys of the attributes to fetch.
   * @param options - Additional options for the fetch operation.
   * @returns A promise that resolves to the fetched object.
   */
  async fetchIfNeeded<T extends _.RecursiveArray<string>>(keys: IncludePaths<T>, options?: ExtraOptions<boolean>) {
    const current = _.keys(this[PVK].attributes);
    if (_.every(keys, k => _.includes(current, k))) return this;
    return this.fetchWithInclude([current, keys], options);
  }

}
