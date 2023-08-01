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

import _ from 'lodash';
import { TValue } from './value';

export enum TComparisonKeys {
  $eq = '$eq',
  $gt = '$gt',
  $gte = '$gte',
  $lt = '$lt',
  $lte = '$lte',
  $ne = '$ne',
};

export enum TValueListKeys {
  $in = '$in',
  $nin = '$nin',
  $all = '$all',
};

export enum TCoditionalKeys {
  $and = '$and',
  $nor = '$nor',
  $or = '$or',
};

export const allFieldQueryKeys = [
  '$not', '$type', '$pattern', '$size', '$every', '$some',
  ..._.keys(TCoditionalKeys),
  ..._.keys(TValueListKeys),
];

export type TFieldQuerySelector = {
  $not?: TFieldQuerySelector;
  $type?: string | string[];
  $pattern?: RegExp | string;
  $size?: number;
  $every?: TQuerySelector;
  $some?: TQuerySelector;
} & { [x in keyof typeof TComparisonKeys]?: TValue; } &
  { [x in keyof typeof TValueListKeys]?: TValue[]; };

export type TCoditionalQuerySelector = { [x in keyof typeof TCoditionalKeys]?: TQuerySelector[]; };
export type TQuerySelector = TCoditionalQuerySelector | { [x: string]: TFieldQuerySelector; };

type _Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type _Lower = 'a' | 'b' | 'c' | 'd' | 'e' |
  'f' | 'g' | 'h' | 'i' | 'j' |
  'k' | 'l' | 'm' | 'n' | 'o' |
  'p' | 'q' | 'r' | 's' | 't' |
  'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type _Upper = Uppercase<_Lower>;
type _Alphabet = _Lower | _Upper;

type _String<T extends string, C extends string | number> = T extends `${infer H}${C}`
  ? H extends '' | _String<H, C> ? T : never
  : never;

export type Digits<T extends string> = _String<T, _Digit>;
export type FieldName<T extends string> = T extends `${'_' | _Alphabet}${_String<infer _U, '_' | _Alphabet | _Digit>}` ? T : never;

type PathArrayGetter<T extends string> = T extends `[${Digits<infer _T>}]` ? T
  : T extends `[${Digits<infer L>}]${infer R}`
  ? `[${L}]${PathArrayGetter<R>}`
  : never;

type PathComponent<T extends string> = T extends Digits<T> | FieldName<T> ? T
  : T extends `${Digits<infer L> | FieldName<infer L>}[${infer _R}`
  ? `${L}${PathArrayGetter<`[${_R}`>}`
  : never;

type PathComponents<T extends string> = T extends PathComponent<T> ? T
  : T extends `${PathComponent<infer L>}.${infer R}`
  ? `${L}.${PathComponents<R>}`
  : never;

export type PathName<T extends string> = T extends PathComponent<T> ? T
  : T extends `${infer L}.${infer R}`
  ? `${PathComponent<L>}.${PathComponents<R>}`
  : never;

export type IncludePath<T extends string> = T extends FieldName<T> ? T
  : T extends `${infer L}.${infer R}`
  ? `${FieldName<L>}.${IncludePath<R>}`
  : never;

export type IncludePaths<T> = T extends [] ? [] :
  T extends [infer H extends string, ...infer R] ?
  H extends undefined ? IncludePaths<R> : [IncludePath<H>, ...IncludePaths<R>] : T;

export type PathNameMap<T extends object> = Extract<T, Extract<{ [K in keyof T as K extends string ? PathName<K> : never]: T[K] }, T>>;
