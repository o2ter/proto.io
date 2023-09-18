//
//  stream.ts
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
import type { Readable as _Readable } from 'stream';
import { Awaitable } from '../internals/types';

export const streamToIterable = <T>(
  stream: ReadableStream<T> | AsyncIterable<T>
) => {
  if (Symbol.asyncIterator in stream) return stream;
  return {
    [Symbol.asyncIterator]: async function* () {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    },
  };
};

export const iterableToStream = <T>(
  iterable: Awaitable<AsyncIterable<T>> | (() => Awaitable<AsyncIterable<T>>)
) => {
  if (typeof ReadableStream === 'undefined') {
    const Readable = require('stream').Readable as typeof _Readable;
    return Readable.from((async function* () {
      const _iterable = _.isFunction(iterable) ? iterable() : iterable;
      yield* await _iterable;
    })());
  }
  let iterator: AsyncIterator<T>;
  return new ReadableStream<T>({
    async start(controller) {
      try {
        const _iterable = _.isFunction(iterable) ? iterable() : iterable;
        iterator = (await _iterable)[Symbol.asyncIterator]();
      } catch (e) {
        controller.error(e);
      }
    },
    async pull(controller) {
      try {
        const { value, done } = await iterator?.next() ?? { done: true };
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
