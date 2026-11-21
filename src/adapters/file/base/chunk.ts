//
//  object.ts
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

import _ from 'lodash';
import { FileStorageBase } from './base';
import { ProtoService } from '../../../server/proto';
import { asyncIterableToArray } from '@o2ter/utils-js';
import { createCacheDebounce } from '../../../internals/debounce';

type ChunkData<File> = {
  start: number;
  file: File;
};

export type ChunkRange = {
  low: number;
  high: number;
  digits: number;
  firstOnly?: boolean;
};

export abstract class FileChunkStorageBase<File> extends FileStorageBase {

  listChunkDebounce = createCacheDebounce(this.options.cacheTimeout);
  readChunkDebounce = createCacheDebounce(this.options.cacheTimeout);

  // For a bounded range, list at most one preceding chunk followed by chunks in ascending order.
  abstract listChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number): AsyncGenerator<ChunkData<File>>;

  abstract readChunk<E>(proto: ProtoService<E>, file: File): PromiseLike<Buffer>;

  // Each bounded listing must return matching offsets in ascending order.
  protected async* listChunkRange(
    list: (range?: ChunkRange) => AsyncGenerator<ChunkData<File>>,
    start?: number,
    end?: number,
  ): AsyncGenerator<ChunkData<File>> {
    if (end === undefined || !Number.isSafeInteger(end) || end <= 0 ||
      (start !== undefined && (!Number.isSafeInteger(start) || start < 0 || start >= end))) {
      yield* list();
      return;
    }

    const first = start ?? 0;
    // Find the preceding chunk without assuming the upload's chunk size.
    if (first > 0) {
      const last = first - 1;
      for (let digits = String(last).length; digits >= 1; digits--) {
        let low = digits === 1 ? 0 : 10 ** (digits - 1);
        let high = Math.min(last, 10 ** digits - 1);
        let previous: ChunkData<File> | undefined;
        for await (const chunk of list({ low, high, digits, firstOnly: true })) {
          previous = chunk;
          break;
        }
        if (!previous) continue;
        low = previous.start;
        while (low < high) {
          const middle = low + Math.ceil((high - low) / 2);
          let found: ChunkData<File> | undefined;
          for await (const chunk of list({ low: middle, high, digits, firstOnly: true })) {
            found = chunk;
            break;
          }
          if (found) {
            previous = found;
            low = found.start;
          } else {
            high = middle - 1;
          }
        }
        yield previous;
        break;
      }
    }

    for (let digits = String(first).length; digits <= String(end - 1).length; digits++) {
      const low = Math.max(first, digits === 1 ? 0 : 10 ** (digits - 1));
      const high = Math.min(end - 1, 10 ** digits - 1);
      if (low <= high) yield* list({ low, high, digits });
    }
  }

  async* readChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number) {
    const batchSize = this.options.chunkSize * this.options.listChunkBatchSize;
    if (!Number.isSafeInteger(batchSize) || batchSize <= 0 ||
      !Number.isSafeInteger(this.options.listChunkBatchSize) || this.options.listChunkBatchSize <= 0) {
      throw Error('Invalid chunk listing batch size');
    }

    const bounded = (start === undefined || Number.isSafeInteger(start) && start >= 0) &&
      (end === undefined || Number.isSafeInteger(end) && end > (start ?? 0));
    let position = start ?? 0;
    let lastStart: number | undefined;
    while (true) {
      const batchEnd = bounded ? Math.min(end ?? Number.MAX_SAFE_INTEGER, position + batchSize) : end;
      const batchStart = bounded ? position : start;
      const streams = await this.listChunkDebounce(JSON.stringify([token, batchStart, batchEnd]), () => asyncIterableToArray(this.listChunks(proto, token, batchStart, batchEnd)));
      const files = _.orderBy(streams, x => x.start);
      const newFiles = files.filter(chunk =>
        (lastStart === undefined || chunk.start > lastStart) &&
        !(end !== undefined && end <= chunk.start) &&
        !(bounded && batchEnd !== undefined && chunk.start >= batchEnd)
      );
      for (const [index, chunk] of newFiles.entries()) {
        const next = newFiles[index + 1];
        if (start !== undefined && next && start >= next.start) continue;
        yield {
          start: chunk.start,
          data: () => this.readChunkDebounce(
            `${token}-${chunk.start}`,
            async () => await this.readChunk(proto, chunk.file)
          ),
        };
      }

      if (!bounded || end !== undefined && batchEnd === end) return;
      if (newFiles.length) lastStart = newFiles[newFiles.length - 1].start;
      position = batchEnd!;
      if (!Number.isSafeInteger(position) || position >= Number.MAX_SAFE_INTEGER) {
        throw Error('Chunk listing range exceeds safe integer limit');
      }
      if (end === undefined && !newFiles.length) {
        let nextStart: number | undefined;
        for await (const chunk of this.listChunks(proto, token, position, Number.MAX_SAFE_INTEGER)) {
          if (chunk.start < position) continue;
          nextStart = chunk.start;
          break;
        }
        if (nextStart === undefined) return;
        position = nextStart;
      }
    }
  }
}