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

export enum UpdateOperation {
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
  fetchWithInclude: (keys: string[], options?: ExtraOptions) => PromiseLike<this>;
  save: (options?: ExtraOptions) => PromiseLike<this>;
  destory: (options?: ExtraOptions) => PromiseLike<this>;
}

export class TObject {

  static defaultKeys = ['_id', '_created_at', '_updated_at'];

  [PVK]: {
    className: string;
    attributes: Record<string, any>;
    mutated: Record<string, [UpdateOperation, any]>;
  };

  constructor(
    className: string,
    attributes?: Record<string, any> | ((self: TObject) => Record<string, any>),
  ) {
    this[PVK] = {
      className,
      attributes: _.isFunction(attributes) ? attributes(this) : attributes ?? {},
      mutated: {},
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

  keys(): string[] {
    return _.uniq([..._.keys(this.attributes), ..._.keys(this[PVK].mutated)]);
  }

  get(key: string): any {
    if (_.isNil(this[PVK].mutated[key])) return this.attributes[key];
    const [op, value] = this[PVK].mutated[key];
    return op === UpdateOperation.set ? value : this.attributes[key];
  }

  set(key: string, value: any) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.set, value];
  }

  unset(key: string) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.set, null];
  }

  get isDirty(): boolean {
    return !_.isEmpty(this[PVK].mutated);
  }

  increment(key: string, value: number) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.increment, value];
  }

  decrement(key: string, value: number) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.increment, -value];
  }

  multiply(key: string, value: number) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.multiply, value];
  }

  divide(key: string, value: number) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.multiply, 1 / value];
  }

  max(key: string, value: any) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.max, value];
  }

  min(key: string, value: any) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.min, value];
  }

  addToSet(key: string, values: any[]) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.addToSet, values];
  }

  push(key: string, values: any[]) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.push, values];
  }

  removeAll(key: string, values: any[]) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.removeAll, values];
  }

  popFirst(key: string) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.popFirst, null];
  }

  popLast(key: string) {
    if (TObject.defaultKeys.includes(key)) return;
    this[PVK].mutated[key] = [UpdateOperation.popLast, null];
  }

  async fetch(options?: ExtraOptions) {
    return this.fetchWithInclude(_.keys(this.attributes), options)
  }

}
