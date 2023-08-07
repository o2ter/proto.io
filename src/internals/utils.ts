//
//  utils.ts
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
import { Awaitable } from './types';

export const isObjKey = <T extends object>(key: PropertyKey, obj: T): key is keyof T => key in obj;

export const asyncIterableToArray = async <T>(asyncIterable: AsyncIterable<T>) => {
  const array: T[] = [];
  for await (const obj of asyncIterable) array.push(obj);
  return array;
};

export const arrayToAsyncGenerator = <T>(array: Awaitable<T[]>) => async function* () {
  yield* await array;
}();

export const asyncStream = <T>(callback: () => Promise<T[]> | AsyncIterable<T>) => ({
  then(...args: Parameters<Promise<T[]>['then']>) {
    const base = callback();
    const promise = base instanceof Promise ? base : asyncIterableToArray(base);
    return promise.then(...args);
  },
  [Symbol.asyncIterator]() {
    const base = callback();
    const iterable = base instanceof Promise ? arrayToAsyncGenerator(base) : base;
    return iterable[Symbol.asyncIterator]();
  },
});
