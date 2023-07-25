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

import { TQuery } from './index';
import { ExtraOptions } from '../options';

type TQuerySelector<T> = {
  $eq?: T;
  $gt?: T;
  $gte?: T;
  $in?: T[];
  $lt?: T;
  $lte?: T;
  $ne?: T;
  $nin?: T[];
  $not?: T extends string ? TQuerySelector<T> | RegExp : TQuerySelector<T>;
  $search?: T extends string ? string : never;
  $regex?: T extends string ? RegExp | string : never;
  $all?: T[];
  $size?: T extends number ? number : never;
  $elemMatch?: TQuerySelector<T> | TFilterQuery<T>;
}

type TRootQuerySelector<T> = {
  $and?: TFilterQuery<T>[];
  $nor?: TFilterQuery<T>[];
  $or?: TFilterQuery<T>[];
  $expr?: T;
};

export type TFilterQuery<T> = TRootQuerySelector<T> | {
  [P in keyof T]?: T[P] | TQuerySelector<T[P]>;
};

type CommonFindOptions = { className: string; options: ExtraOptions & { acls?: string[]; }; };
export type FindOptions = CommonFindOptions & Omit<TQuery.Options, 'returning'>;
export type FindOneOptions = CommonFindOptions & Omit<TQuery.Options, 'skip' | 'limit'>;
