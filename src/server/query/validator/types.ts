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

type _Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type _Lower = 'a' | 'b' | 'c' | 'd' | 'e' |
  'f' | 'g' | 'h' | 'i' | 'j' |
  'k' | 'l' | 'm' | 'n' | 'o' |
  'p' | 'q' | 'r' | 's' | 't' |
  'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type _Upper = Uppercase<_Lower>;
type _Alphabet = _Lower | _Upper;

type _String<T, C extends string | number> = T extends `${C}${infer Tails}`
  ? Tails extends _String<Tails, C> | '' ? T : never
  : never;

export type Digits<T> = _String<T, _Digit>;
export type FieldName<T> = T extends `${'_' | _Alphabet}${_String<infer _U, '_' | _Alphabet | _Digit>}` ? T : never;

type PathComponent<T> = T extends `.${FieldName<infer _U> | Digits<infer _U>}` | `[${Digits<infer _U>}]` ? T : never;
export type PathName<T> = T extends `${FieldName<infer _U>}${infer Tails}`
  ? Tails extends _String<Tails, PathComponent<infer _T>> | '' ? T : never
  : never;
