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

import { IOObject } from './index';
import { IOUser } from './user';
import { IORole } from './role';

export const IOObjectTypes = {
  '_User': IOUser,
  '_Role': IORole,
};

export type IOObjectType<T> = T extends keyof typeof IOObjectTypes ? InstanceType<(typeof IOObjectTypes)[T]> : IOObject;

type PropertyDescriptor<T> = {
  enumerable?: boolean;
  get: () => T;
  set?: (value: T) => void;
};
type PropertyMapToExt<T> = {
  [P in keyof T as T[P] extends Function ? P : never]: T[P];
} & {
  [P in keyof T as T[P] extends Required<Pick<PropertyDescriptor<any>, 'get' | 'set'>> ? P : never]: T[P] extends PropertyDescriptor<infer V> ? V : never;
} & {
  readonly [P in keyof T as T[P] extends Pick<PropertyDescriptor<any>, 'get'> ? P : never]: T[P] extends PropertyDescriptor<infer V> ? V : never;
}
type Property<T> = T extends Function ? T | PropertyDescriptor<T> : PropertyDescriptor<T>;
type PropertyMap<T, O> = {
  [K in keyof T]: T[K] extends Property<any> ? T[K] : never;
} & ThisType<O & PropertyMapToExt<T>>;

export type IOObjectExtension<T> = {
  [K in keyof T]: PropertyMap<T[K], IOObjectType<K>>;
};

export type IOObjectWithExt<T, K> = K extends keyof T ? PropertyMapToExt<T[K]> : {};
