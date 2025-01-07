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

import Decimal from 'decimal.js';
import { TObject } from './object';

export type _TContainer<Primitive> = { [x: string]: _TContainer<Primitive>; } | _TContainer<Primitive>[] | Primitive;

export type TPrimitiveValue = boolean | number | Decimal | string | Date | null;
export type _TValue = _TContainer<TPrimitiveValue>;
export type TValue = _TContainer<TPrimitiveValue | TObject>;

export type Exact<T, Shape> =
  T extends Shape ?
  Exclude<keyof T, keyof Shape> extends never ?
  T : never : never;

export type ExactOneProp<T> = {
  [K in keyof T]-?: Pick<T, K> & { [P in Exclude<keyof T, K>]?: never }
}[keyof T];
