//
//  types.ts
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

import { TObject } from './index';
import { TUser } from './user';
import { TRole } from './role';
import { TFile } from './file';
import { TValueWithUndefined } from '../types';
import { ExactOneProp } from '../types';
import { TJob } from './job';
import { TSession } from './session';

export const TObjectTypes = {
  'User': TUser,
  'Role': TRole,
  'File': TFile,
  '_Job': TJob,
  '_Session': TSession,
};

type _TObjectType<K> = K extends keyof typeof TObjectTypes ? InstanceType<(typeof TObjectTypes)[K]> : TObject;

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

type PropertyMapToMethods<T> = PickBy<T, Function>
  & { [P in keyof PickBy<T, ReadWriteProperty<any>>]: T[P] extends PropertyDescriptor<infer V> ? V : never; }
  & { readonly [P in keyof PickBy<T, ReadOnlyProperty<any>>]: T[P] extends PropertyDescriptor<infer V> ? V : never; }
type Property<T> = T extends Function ? T | PropertyDescriptor<T> : PropertyDescriptor<T>;
type PropertyMap<T, O, A> = {
  [K in keyof T]: T[K] extends Property<any> ? T[K] : never;
} & ThisType<O & PropertyMapToMethods<T> & PropertyMapToMethods<A>>;

export type TExtensions<E> = {
  [K in keyof E]: PropertyMap<E[K], _TObjectType<K>, '*' extends keyof E ? Omit<E['*'], keyof E[K]> : {}>;
};

type _TMethods<K, E> = K extends keyof E
  ? '*' extends keyof E ? PropertyMapToMethods<Omit<E['*'], keyof E[K]> & E[K]> : PropertyMapToMethods<E[K]>
  : {};

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
type TMethods<K, E> = IfAny<E, {}, _TMethods<K, E>>;

export type TObjectType<K, E> = _TObjectType<K> & TMethods<K, E>;

export const TUpdateOpKeys = [
  '$set',
  '$inc',
  '$dec',
  '$mul',
  '$div',
  '$max',
  '$min',
  '$addToSet',
  '$push',
  '$removeAll',
  '$popFirst',
  '$popLast',
] as const;

export type TUpdateOp = ExactOneProp<Record<(typeof TUpdateOpKeys)[number], TValueWithUndefined>>;
