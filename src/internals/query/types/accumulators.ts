//
//  accumulators.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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

import { TExpression } from './expressions';

export const TUnaryAccumulatorKeys = [
  '$max',
  '$min',
  '$most',
  '$sum',
  '$avg',
  '$stdDevPop',
  '$stdDevSamp',
  '$varPop',
  '$varSamp'
] as const;

export const TZeroParamAccumulatorKeys = [
  '$count'
] as const;

export type TQueryAccumulator = {
  $percentile?: {
    input: TExpression;
    p: number;
    mode?: 'discrete' | 'continuous';
  };
  $group?: {
    key: TExpression;
    value: Omit<TQueryAccumulator, '$group'>;
  };
} & {
  [x in (typeof TZeroParamAccumulatorKeys)[number]]?: true | {};
} & {
  [x in (typeof TUnaryAccumulatorKeys)[number]]?: TExpression;
};

export type TAccumulatorResult<A extends TQueryAccumulator> =
  A extends { $group: any }
  ? { key: any; value: any; }[]
  : A extends { $count: any } ? number : any;
