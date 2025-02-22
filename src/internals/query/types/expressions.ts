//
//  expressions.ts
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

import { TValue } from '../../types';
import { TComparisonKeys, TConditionalKeys } from './keys';

export const TZeroParamExprKeys = [
  '$now',
  '$rand',
] as const;

export const TUnaryExprKeys = [
  '$abs',
  '$neg',
  '$sqrt',
  '$cbrt',
  '$ceil',
  '$floor',
  '$round',
  '$exp',
  '$ln',
  '$log2',
  '$log10',
  '$sin',
  '$cos',
  '$tan',
  '$asin',
  '$acos',
  '$atan',
  '$asinh',
  '$acosh',
  '$atanh',
  '$sinh',
  '$cosh',
  '$tanh',
  '$degrees',
  '$radians',
  '$sign',
  '$size',
  '$lower',
  '$upper',
] as const;

export const TBinaryExprKeys = [
  '$log',
  '$pow',
  '$divide',
  '$subtract',
  '$atan2',
] as const;

export const TListExprKeys = [
  '$add',
  '$multiply',
  '$ifNull',
  '$concat',
] as const;

export const TTrimExprKeys = [
  '$trim',
  '$ltrim',
  '$rtrim',
] as const;

export const TDistanceExprKeys = [
  '$distance',
  '$innerProduct',
  '$negInnerProduct',
  '$cosineDistance',
  '$rectilinearDistance',
] as const;

export type TBooleanExpression = {
  $not?: TBooleanExpression;
} & {
    [x in (typeof TComparisonKeys)[number]]?: [TExpression, TExpression];
  } & {
    [x in (typeof TConditionalKeys)[number]]?: TBooleanExpression[];
  };

export type TDistanceExpression = {
  [x in (typeof TDistanceExprKeys)[number]]?: [
    TExpression[] | { $key: string; } | { $value: number[]; },
    TExpression[] | { $key: string; } | { $value: number[]; },
  ];
};

export type TExpression = {
  $array?: TExpression[];
  $key?: string;
  $value?: TValue;
} & {
  $cond?: {
    branch: _.Many<{
      case: TExpression;
      then: TExpression;
    }[]>;
    default: TExpression;
  };
} & {
  $trunc?: [TExpression] | [TExpression, TExpression];
} & {
  [x in (typeof TZeroParamExprKeys)[number]]?: true | {};
} & {
  [x in (typeof TUnaryExprKeys)[number]]?: TExpression;
} & {
  [x in (typeof TBinaryExprKeys)[number]]?: [TExpression, TExpression];
} & {
  [x in (typeof TListExprKeys)[number]]?: TExpression[];
} & {
  [x in (typeof TTrimExprKeys)[number]]?: {
    input: TExpression;
    chars?: TExpression;
  };
} & TBooleanExpression & TDistanceExpression;
