//
//  stream.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { binaryToBuffer } from '@o2ter/utils-js';

export async function* streamChunk(
  stream: BinaryData | AsyncIterable<BinaryData>,
  chunkSize: number
) {
  if (Symbol.asyncIterator in stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, binaryToBuffer(chunk)]);
      while (buffer.byteLength >= chunkSize) {
        yield buffer.subarray(0, chunkSize);
        buffer = buffer.subarray(chunkSize);
      }
    }
    if (buffer.length) yield buffer;
  } else {
    let buffer = binaryToBuffer(stream);
    while (buffer.byteLength >= chunkSize) {
      yield buffer.subarray(0, chunkSize);
      buffer = buffer.subarray(chunkSize);
    }
    if (buffer.length) yield buffer;
  }
}

export async function* parallelMap<T, R>(
  stream: AsyncIterable<T>,
  parallel: number,
  transform: (value: T) => PromiseLike<R>
) {
  const queue: Promise<R>[] = [];
  try {
    for await (const value of stream) {
      if (queue.length >= parallel) yield queue.shift()!;
      queue.push((async () => transform(value))());
    }
    while (!_.isEmpty(queue)) yield queue.shift()!;
  } finally {
    await Promise.allSettled(queue);
  }
}

export async function parallelEach<T>(
  stream: AsyncIterable<T>,
  parallel: number,
  callback: (value: T) => PromiseLike<void>
) {
  for await (const _ of parallelMap(stream, parallel, callback)) { }
}
