//
//  types.ts
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

import { TObject } from './index';
import { TUser } from './user';
import { TRole } from './role';

export const TObjectTypes = {
  '_User': TUser,
  '_Role': TRole,
};

export type TObjectType<T> = T extends keyof typeof TObjectTypes ? InstanceType<(typeof TObjectTypes)[T]> : TObject;

type PickBy<T, C> = {
  [P in keyof T as T[P] extends C ? P : never]: T[P];
}

type PropertyDescriptor<T> = {
  enumerable?: boolean;
  get: () => T;
  set?: (value: T) => void;
};
type ReadOnlyProperty<T> = Pick<PropertyDescriptor<T>, 'get'>;
type ReadWriteProperty<T> = Required<Pick<PropertyDescriptor<T>, 'get' | 'set'>>;

type PropertyMapToMethods<T> = PickBy<T, Function> &
  {
    [P in keyof PickBy<T, ReadWriteProperty<any>>]: T[P] extends PropertyDescriptor<infer V> ? V : never;
  } &
  {
    readonly [P in keyof PickBy<T, ReadOnlyProperty<any>>]: T[P] extends PropertyDescriptor<infer V> ? V : never;
  }
type Property<T> = T extends Function ? T | PropertyDescriptor<T> : PropertyDescriptor<T>;
type PropertyMap<T, O> = {
  [K in keyof T]: T[K] extends Property<any> ? T[K] : never;
} & ThisType<O & PropertyMapToMethods<T>>;

export type TExtensions<T> = {
  [K in keyof T]: PropertyMap<T[K], TObjectType<K>>;
};

export type TMethods<T, K> = K extends keyof T ? PropertyMapToMethods<T[K]> : {};
