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
import { TSchema } from '../schema';

export enum UpdateOp {
  set = 'set',
  increment = 'inc',
  multiply = 'mul',
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
  save(options?: ExtraOptions): PromiseLike<this>;
  destory(options?: ExtraOptions): PromiseLike<this>;
}

export class TObject {

  static defaultReadonlyKeys = ['_id', '_created_at', '_updated_at'];
  static defaultKeys = [...TObject.defaultReadonlyKeys, '_expired_at', '_acl'];

  [PVK]: {
    className: string;
    attributes: Record<string, any>;
    mutated: Record<string, [UpdateOp, any]>;
    extra: Record<string, any>;
  };

  constructor(
    className: string,
    attributes?: Record<string, any> | ((self: TObject) => Record<string, any>),
  ) {
    this[PVK] = {
      className,
      attributes: _.isFunction(attributes) ? attributes(this) : attributes ?? {},
      mutated: {},
      extra: {},
    }
  }

  get className(): string {
    return this[PVK].className;
  }

  get attributes(): Record<string, any> {
    return this[PVK].attributes;
  }

  get objectId(): string | undefined {
    return this[PVK].attributes._id;
  }

  get createdAt(): Date | undefined {
    return this[PVK].attributes._created_at;
  }

  get updatedAt(): Date | undefined {
    return this[PVK].attributes._updated_at;
  }

  get expiredAt(): Date | undefined {
    return this.get('_expired_at');
  }

  set expiredAt(value: Date | undefined) {
    this.set('_expired_at', value);
  }

  get acl(): TSchema.ACLs {
    return this.get('_acl') ?? {};
  }

  set acl(value: TSchema.ACLs) {
    this.set('_acl', value);
  }

  keys(): string[] {
    return _.uniq([..._.keys(this.attributes), ..._.keys(this[PVK].mutated)]);
  }

  get(key: string): any {
    if (_.isNil(this[PVK].mutated[key])) return this.attributes[key];
    const [op, value] = this[PVK].mutated[key];
    return op === UpdateOp.set ? value : this.attributes[key];
  }

  set(key: string, value: any) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.set, value];
  }

  unset(key: string) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.set, null];
  }

  get isDirty(): boolean {
    return !_.isEmpty(this[PVK].mutated);
  }

  increment(key: string, value: number) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.increment, value];
  }

  decrement(key: string, value: number) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.increment, -value];
  }

  multiply(key: string, value: number) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.multiply, value];
  }

  divide(key: string, value: number) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.multiply, 1 / value];
  }

  max(key: string, value: any) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.max, value];
  }

  min(key: string, value: any) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.min, value];
  }

  addToSet(key: string, values: any[]) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.addToSet, values];
  }

  push(key: string, values: any[]) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.push, values];
  }

  removeAll(key: string, values: any[]) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.removeAll, values];
  }

  popFirst(key: string) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.popFirst, null];
  }

  popLast(key: string) {
    if (TObject.defaultReadonlyKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOp.popLast, null];
  }

  async fetch(options?: ExtraOptions) {
    return this.fetchWithInclude(_.keys(this.attributes), options);
  }

  async fetchIfNeeded(keys: string[], options?: ExtraOptions) {
    const current = _.keys(this.attributes);
    if (_.every(keys, k => _.includes(current, k))) return this;
    return this.fetchWithInclude(_.uniq([...current, ...keys]), options);
  }

}
