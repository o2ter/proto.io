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
import { Decimal } from 'decimal.js';
import { TObject } from '../object';
import { ExtraOptions } from '../options';

type TPrimitiveValue = boolean | number | Decimal | string | Date | null;
type TDictionaryValue = { [x: string]: TValue };
export type TValue = TDictionaryValue | TValue[] | TPrimitiveValue | TObject;

export const enum TComparisonKeys {
  $eq = '$eq',
  $gt = '$gt',
  $gte = '$gte',
  $lt = '$lt',
  $lte = '$lte',
  $ne = '$ne',
};

export const enum TValueListKeys {
  $in = '$in',
  $nin = '$nin',
  $all = '$all',
};

export const enum TCoditionalKeys {
  $and = '$and',
  $nor = '$nor',
  $or = '$or',
};

export type TQuerySelector = {
  $not?: TQuerySelector;
  $type?: string | string[];
  $search?: string;
  $regex?: RegExp | string;
  $size?: number;
  $elemMatch?: TQuerySelector | TFilterQuery;
} & { [x in keyof typeof TComparisonKeys]?: TValue; } &
  { [x in keyof typeof TValueListKeys]?: TValue[]; };

export type TRootQuerySelector = { [x in keyof typeof TCoditionalKeys]?: TFilterQuery[]; };

export type TFilterQuery = TRootQuerySelector & {
  [x: string]: TQuerySelector;
};

type CommonFindOptions = { className: string; };
export type ExplainOptions = CommonFindOptions & Omit<TQuery.Options, 'returning' | 'skip' | 'limit'>;
export type FindOptions = CommonFindOptions & Omit<TQuery.Options, 'returning'>;
export type FindOneOptions = CommonFindOptions & Omit<TQuery.Options, 'skip' | 'limit'>;
