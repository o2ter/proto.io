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

type ChunkListingCache<File> = {
  chunks: Map<number, ChunkData<File>[]>;
  ranges: { start: number; end: number }[];
  pending: { start: number; end: number; result: Promise<void> }[];
  timer?: ReturnType<typeof setTimeout>;
  users: { start: number; end: number }[];
};

function mergeRanges(ranges: { start: number; end: number }[]) {
  const merged: { start: number; end: number }[] = [];
  for (const range of _.sortBy(ranges, range => range.start)) {
    const last = merged[merged.length - 1];
    if (last && last.end >= range.start) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export type ChunkRange = {
  low: number;
  high: number;
  digits: number;
  firstOnly?: boolean;
};

export abstract class FileChunkStorageBase<File> extends FileStorageBase {

  private chunkListingCaches = new Map<string, ChunkListingCache<File>>();
  readChunkDebounce = createCacheDebounce(this.options.cacheTimeout);

  // For a bounded range, list at most one preceding chunk followed by chunks in ascending order.
  abstract listChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number): AsyncGenerator<ChunkData<File>>;

  abstract readChunk<E>(proto: ProtoService<E>, file: File): PromiseLike<Buffer>;

  private async cachedChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number): Promise<ChunkData<File>[]> {
    if (start === undefined || end === undefined || !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) || start < 0 || end <= start) {
      return asyncIterableToArray(this.listChunks(proto, token, start, end));
    }

    let cache = this.chunkListingCaches.get(token);
    if (!cache) {
      cache = { chunks: new Map(), ranges: [], pending: [], users: [] };
      this.chunkListingCaches.set(token, cache);
    }
    const entry = cache;
    const user = { start, end };
    const refresh = () => {
      if (!(this.options.cacheTimeout > 0) || !entry.ranges.length ||
        this.chunkListingCaches.get(token) !== entry) return;
      if (entry.timer !== undefined) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        if (this.chunkListingCaches.get(token) === entry) this.chunkListingCaches.delete(token);
      }, this.options.cacheTimeout);
    };

    refresh();
    entry.users.push(user);
    try {
      let cursor = start;
      while (cursor < end) {
        const covered = entry.ranges.find(range => range.start <= cursor && range.end > cursor);
        if (covered) {
          cursor = Math.min(end, covered.end);
          continue;
        }
        const pending = entry.pending.find(range => range.start <= cursor && range.end > cursor);
        if (pending) {
          await pending.result;
          continue;
        }
        let boundary = end;
        for (const range of [...entry.ranges, ...entry.pending]) {
          if (range.start > cursor) boundary = Math.min(boundary, range.start);
        }
        const from = cursor;
        const request = {
          start: from,
          end: boundary,
          result: Promise.resolve(),
        };
        request.result = (async () => {
          try {
            const chunks = await asyncIterableToArray(this.listChunks(proto, token, from, boundary));
            const byStart = _.groupBy(chunks, chunk => chunk.start);
            for (const group of Object.values(byStart)) entry.chunks.set(group[0].start, group);
            entry.ranges = mergeRanges([...entry.ranges, { start: from, end: boundary }]);
            refresh();
          } finally {
            entry.pending.splice(entry.pending.indexOf(request), 1);
          }
        })();
        entry.pending.push(request);
        await request.result;
      }

      const groups = _.sortBy([...entry.chunks.values()], group => group[0].start);
      const preceding = _.findLast(groups, group => group[0].start < start);
      return [
        ...preceding ?? [],
        ...groups.filter(group => group[0].start >= start && group[0].start < end).flat(),
      ];
    } finally {
      entry.users.splice(entry.users.indexOf(user), 1);
      if (!entry.users.length && (!entry.ranges.length || !(this.options.cacheTimeout > 0))) {
        if (this.chunkListingCaches.get(token) === entry) this.chunkListingCaches.delete(token);
      } else if (!(this.options.cacheTimeout > 0)) {
        // Keep only completed coverage still needed by concurrent readers.
        entry.ranges = mergeRanges(entry.ranges.flatMap(range => entry.users.flatMap(user => {
          const start = Math.max(range.start, user.start);
          const end = Math.min(range.end, user.end);
          return start < end ? [{ start, end }] : [];
        })));
        const groups = _.sortBy([...entry.chunks.values()], group => group[0].start);
        const retained = new Set<number>();
        for (const range of entry.ranges) {
          const preceding = _.findLast(groups, group => group[0].start < range.start);
          if (preceding) retained.add(preceding[0].start);
          for (const group of groups) {
            if (group[0].start >= range.start && group[0].start < range.end) retained.add(group[0].start);
          }
        }
        for (const offset of entry.chunks.keys()) {
          if (!retained.has(offset)) entry.chunks.delete(offset);
        }
      }
    }
  }

  // Each bounded listing must return matching offsets in ascending order.
  protected async* listChunkRange(
    list: (range?: ChunkRange) => AsyncGenerator<ChunkData<File>>,
    start?: number,
    end?: number,
    lookbehind?: number,
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
      let preceding: ChunkData<File> | undefined;
      if (lookbehind !== undefined && Number.isSafeInteger(lookbehind) && lookbehind > 0) {
        const windowStart = Math.max(0, first - lookbehind);
        for (let digits = String(last).length; digits >= String(windowStart).length; digits--) {
          const low = Math.max(windowStart, digits === 1 ? 0 : 10 ** (digits - 1));
          const high = Math.min(last, 10 ** digits - 1);
          let count = 0;
          let candidate: ChunkData<File> | undefined;
          for await (const chunk of list({ low, high, digits })) {
            // Fall back to the bounded search if the window contains many chunks.
            if (++count > 8) break;
            candidate = chunk;
          }
          if (count > 8) break;
          if (candidate) {
            preceding = candidate;
            break;
          }
        }
      }
      for (let digits = String(last).length; !preceding && digits >= 1; digits--) {
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
        preceding = previous;
        break;
      }
      if (preceding) yield preceding;
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
    const list = (from: number | undefined, to: number | undefined) =>
      this.cachedChunks(proto, token, from, to);
    const batchEndFor = (from: number) => Math.min(end ?? Number.MAX_SAFE_INTEGER, from + batchSize);
    type Listing = { files: ChunkData<File>[]; error?: never } | { error: unknown; files?: never };
    const prefetch = (from: number, to: number): Promise<Listing> =>
      list(from, to).then(files => ({ files }), error => ({ error }));
    let position = start ?? 0;
    let lastStart: number | undefined;
    let pending: Promise<Listing> | undefined;
    while (true) {
      const batchEnd = bounded ? batchEndFor(position) : end;
      const batchStart = bounded ? position : start;
      const current = pending ?? list(batchStart, batchEnd).then(files => ({ files }), error => ({ error }));
      pending = undefined;
      if (bounded && batchEnd !== undefined && batchEnd < (end ?? Number.MAX_SAFE_INTEGER)) {
        pending = prefetch(batchEnd, batchEndFor(batchEnd));
      }
      const result = await current;
      if ('error' in result) throw result.error;
      const streams = result.files;
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
        pending = undefined;
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