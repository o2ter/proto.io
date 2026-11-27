//
//  chunk-range.test.ts
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

import { expect, jest, test } from '@jest/globals';
import { Bucket, File, GetFilesOptions, Storage } from '@google-cloud/storage';
import OSS from 'ali-oss';
import { randomBytes, randomInt } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { deflateSync } from 'zlib';
import { FileStorageBase } from '../../src/adapters/file/base';
import { AliyunObjectStorage } from '../../src/adapters/file/aliyun-oss';
import { FileSystemStorage } from '../../src/adapters/file/filesystem';
import { GoogleCloudStorage } from '../../src/adapters/file/google-cloud-storage';
import { ProtoService } from '../../src/server/proto';

const proto: ProtoService<never> = Object.create(null);

function fixture(offsets: number[], content: Buffer, cacheTimeout = 0) {
  const token = 'file[1]';
  const files: File[] = offsets.map((start, index) => Object.assign(Object.create(null), {
    name: `${token}/${start}.chunk`,
    download: async () => [deflateSync(content.subarray(start, offsets[index + 1]))],
  }));
  let returned = 0;
  const queries: GetFilesOptions[] = [];
  const bucket: Bucket = Object.assign(Object.create(null), {
    getFiles: async (query: GetFilesOptions) => {
      queries.push(query);
      let pattern = '^';
      for (let i = 0; i < (query.matchGlob?.length ?? 0); i++) {
        const char = query.matchGlob![i];
        if (char === '\\') {
          pattern += `\\${query.matchGlob![++i]}`;
        } else if (query.matchGlob!.slice(i, i + 5) === '[0-9]') {
          pattern += '[0-9]';
          i += 4;
        } else {
          pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
      const glob = query.matchGlob ? new RegExp(`${pattern}$`) : undefined;
      const matching = files.filter(file =>
        file.name.startsWith(query.prefix ?? '') &&
        (!query.startOffset || file.name >= query.startOffset) &&
        (!query.endOffset || file.name < query.endOffset) &&
        (!glob || glob.test(file.name))
      ).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      const offset = Number(query.pageToken ?? 0);
      const count = Math.min(query.maxResults ?? 2, 2);
      const page = matching.slice(offset, offset + count);
      returned += page.length;
      const next = offset + count < matching.length ? { ...query, pageToken: String(offset + count) } : null;
      return [page, next, {}];
    },
  });
  const client = new Storage({ projectId: 'test' });
  jest.spyOn(client, 'bucket').mockReturnValue(bucket);
  return {
    token,
    storage: new GoogleCloudStorage(client, 'bucket', { cacheTimeout }),
    queries,
    returned: () => returned,
  };
}

async function read(storage: FileStorageBase, token: string, start?: number, end?: number) {
  const chunks: Buffer[] = [];
  for await (const chunk of storage.fileData(proto, token, start, end)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('reads ranges across variable chunk sizes and decimal digit boundaries', async () => {
  const content = Buffer.from(Array.from({ length: 1300 }, (_, i) => i % 251));
  const { storage, token, queries } = fixture([0, 9, 80, 150, 240, 300, 999, 1000], content);

  expect(await read(storage, token, 100, 250)).toEqual(content.subarray(100, 250));
  expect(await read(storage, token, 150, 240)).toEqual(content.subarray(150, 240));
  expect(await read(storage, token, 950, 1010)).toEqual(content.subarray(950, 1010));
  expect(await read(storage, token, 1200, 1250)).toEqual(content.subarray(1200, 1250));
  expect(await read(storage, token, undefined, 81)).toEqual(content.subarray(0, 81));
  expect(await read(storage, token, 100)).toEqual(content.subarray(100));
  expect(queries.some(query => query.matchGlob?.startsWith('file\\[1\\]/'))).toBe(true);
});

test('reuses covered token metadata and lists only missing ranges', async () => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from(Array.from({ length: 400 }, (_, i) => i % 251));
    const { storage, token } = fixture([0, 100, 200, 300], content, 1000);
    const list = jest.spyOn(storage, 'listChunks');
    expect(await read(storage, token, 110, 250)).toEqual(content.subarray(110, 250));
    expect(await read(storage, token, 120, 220)).toEqual(content.subarray(120, 220));
    expect(await read(storage, token, 50, 320)).toEqual(content.subarray(50, 320));
    expect(await read(storage, token, 75, 310)).toEqual(content.subarray(75, 310));
    expect(list.mock.calls.map(call => call.slice(2))).toEqual([[110, 250], [50, 110], [250, 320]]);

    expect(await read(storage, 'other', 120, 220)).toEqual(Buffer.alloc(0));
    expect(list.mock.calls.map(call => call[1])).toEqual([token, token, token, 'other']);
    jest.advanceTimersByTime(1000);
    expect(await read(storage, token, 120, 220)).toEqual(content.subarray(120, 220));
    expect(list.mock.calls.slice(-1)[0].slice(2)).toEqual([120, 220]);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('expires token metadata after its last use', async () => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from('abcdefghij');
    const { storage, token } = fixture([0], content, 1000);
    const list = jest.spyOn(storage, 'listChunks');
    expect(await read(storage, token, 1, 9)).toEqual(content.subarray(1, 9));
    jest.advanceTimersByTime(800);
    expect(await read(storage, token, 2, 8)).toEqual(content.subarray(2, 8));
    jest.advanceTimersByTime(200);
    expect(await read(storage, token, 3, 7)).toEqual(content.subarray(3, 7));
    expect(list).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(await read(storage, token, 3, 7)).toEqual(content.subarray(3, 7));
    expect(list).toHaveBeenCalledTimes(2);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test.each([0, 1000])('shares overlapping in-flight listings with cacheTimeout %i', async cacheTimeout => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 251));
    const { storage, token } = fixture([0, 100, 200], content, cacheTimeout);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const listingStarted = new Promise<void>(resolve => { started = resolve; });
    const original = storage.listChunks.bind(storage);
    const list = jest.spyOn(storage, 'listChunks').mockImplementation(async function* (proto, token, start, end) {
      if (start === 10) {
        started();
        await gate;
      }
      yield* original(proto, token, start, end);
    });
    const first = read(storage, token, 10, 150);
    await listingStarted;
    const second = read(storage, token, 50, 250);
    try {
      expect(list.mock.calls.map(call => call.slice(2))).toEqual([[10, 150]]);
      jest.advanceTimersByTime(1001);
    } finally {
      release();
    }
    expect(await first).toEqual(content.subarray(10, 150));
    expect(await second).toEqual(content.subarray(50, 250));
    expect(list.mock.calls.map(call => call.slice(2))).toEqual([[10, 150], [150, 250]]);
    if (cacheTimeout) {
      expect(await read(storage, token, 60, 90)).toEqual(content.subarray(60, 90));
      expect(list).toHaveBeenCalledTimes(2);
    }
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('does not cache failed or partially completed listings', async () => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 251));
    const { storage, token } = fixture([0, 100, 200], content, 1000);
    const original = storage.listChunks.bind(storage);
    let fail = true;
    const list = jest.spyOn(storage, 'listChunks').mockImplementation(async function* (proto, token, start, end) {
      for await (const chunk of original(proto, token, start, end)) {
        yield chunk;
        if (fail) {
          fail = false;
          throw Error('Listing failed');
        }
      }
    });
    await expect(read(storage, token, 10, 150)).rejects.toThrow('Listing failed');
    expect(await read(storage, token, 10, 150)).toEqual(content.subarray(10, 150));
    expect(list.mock.calls.map(call => call.slice(2))).toEqual([[10, 150], [10, 150]]);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('does not add an expired in-flight listing to a replacement cache', async () => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 251));
    const { storage, token } = fixture([0, 100, 200], content, 1000);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const listingStarted = new Promise<void>(resolve => { started = resolve; });
    const original = storage.listChunks.bind(storage);
    const list = jest.spyOn(storage, 'listChunks').mockImplementation(async function* (proto, token, start, end) {
      if (start === 200) {
        started();
        await gate;
      }
      yield* original(proto, token, start, end);
    });
    expect(await read(storage, token, 0, 50)).toEqual(content.subarray(0, 50));
    const old = read(storage, token, 200, 250);
    await listingStarted;
    try {
      jest.advanceTimersByTime(1000);
      expect(await read(storage, token, 0, 50)).toEqual(content.subarray(0, 50));
    } finally {
      release();
    }
    expect(await old).toEqual(content.subarray(200, 250));
    expect(await read(storage, token, 210, 240)).toEqual(content.subarray(210, 240));
    expect(list.mock.calls.map(call => call.slice(2))).toEqual([
      [0, 50], [200, 250], [0, 50], [210, 240],
    ]);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('does not retain completed metadata when cacheTimeout is zero', async () => {
  const content = Buffer.from('abcdefghij');
  const { storage, token } = fixture([0], content);
  const list = jest.spyOn(storage, 'listChunks');
  expect(await read(storage, token, 1, 5)).toEqual(content.subarray(1, 5));
  expect(await read(storage, token, 2, 4)).toEqual(content.subarray(2, 4));
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([[1, 5], [2, 4]]);
});

test('streams bounded listings incrementally without repeating boundary chunks', async () => {
  const content = Buffer.from(Array.from({ length: 200 }, (_, i) => i));
  const { storage, token } = fixture([0, 7, 42, 53, 96, 120, 180], content);
  storage.options.chunkSize = 10;
  storage.options.listChunkBatchSize = 2;
  const list = jest.spyOn(storage, 'listChunks');
  const iterator = storage.readChunks(proto, token, 3, 125);
  const first = await iterator.next();
  expect(first.value?.start).toBe(0);
  expect(list.mock.calls.slice(0, 2).map(call => call.slice(2))).toEqual([[3, 23], [23, 43]]);
  const offsets = [first.value!.start];
  for await (const chunk of iterator) offsets.push(chunk.start);
  expect(offsets).toEqual([0, 7, 42, 53, 96, 120]);
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([
    [3, 23], [23, 43], [43, 63], [63, 83], [83, 103], [103, 123], [123, 125],
  ]);
  expect(await read(storage, token, 3, 125)).toEqual(content.subarray(3, 125));
});

test('finds later chunks and EOF without reading open-ended chunk data', async () => {
  const content = randomBytes(137);
  const { storage, token } = fixture([0, 7, 90, 110], content);
  storage.options.chunkSize = 10;
  storage.options.listChunkBatchSize = 2;
  const list = jest.spyOn(storage, 'listChunks');
  const download = jest.spyOn(storage, 'readChunk');
  const offsets = [];
  for await (const chunk of storage.readChunks(proto, token, 10)) offsets.push(chunk.start);
  expect(offsets).toEqual([7, 90, 110]);
  expect(download).not.toHaveBeenCalled();
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([
    [10, 30], [30, 50], [50, 70], [50, Number.MAX_SAFE_INTEGER],
    [90, 110], [110, 130], [130, 150], [150, 170], [150, Number.MAX_SAFE_INTEGER],
  ]);
  list.mockClear();
  expect(await read(storage, token, 10)).toEqual(content.subarray(10));
  list.mockClear();
  expect(await read(storage, token, 137)).toEqual(Buffer.alloc(0));
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([
    [137, 157], [157, 177], [177, 197], [177, Number.MAX_SAFE_INTEGER],
  ]);
});

test.each([0, 1000])('streams while adjacent listings are in flight with cacheTimeout %i', async cacheTimeout => {
  const content = Buffer.from('abcdefghijABCDEFGHIJ');
  const { storage, token } = fixture([0, 10], content, cacheTimeout);
  storage.options.chunkSize = 10;
  storage.options.listChunkBatchSize = 1;
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  let bothStarted!: () => void;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const secondGate = new Promise<void>(resolve => { releaseSecond = resolve; });
  const started = new Promise<void>(resolve => { bothStarted = resolve; });
  const active = new Set<number>();
  const original = storage.listChunks.bind(storage);
  jest.spyOn(storage, 'listChunks').mockImplementation(async function* (proto, token, start, end) {
    if (start === 0 || start === 10) {
      active.add(start);
      if (active.size === 2) bothStarted();
      await (start === 0 ? firstGate : secondGate);
    }
    yield* original(proto, token, start, end);
  });
  const iterator = storage.fileData(proto, token, 0, 20);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const within = <T>(promise: Promise<T>) => Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Streaming stalled')), 3000); }),
  ]).finally(() => clearTimeout(timer));
  try {
    const first = iterator.next();
    await within(started);
    releaseFirst();
    expect((await within(first)).value).toEqual(content.subarray(0, 10));
    releaseSecond();
    expect((await within(iterator.next())).value).toEqual(content.subarray(10));
    expect((await within(iterator.next())).done).toBe(true);
  } finally {
    releaseFirst();
    releaseSecond();
    await iterator.return();
  }
});

test('downloads chunks concurrently while preserving output order', async () => {
  const content = Buffer.from('abcdefghijABCDEFGHIJ');
  const { storage, token } = fixture([0, 10], content);
  storage.options.parallel = 2;
  let releaseFirst!: () => void;
  let secondStarted!: () => void;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const started = new Promise<void>(resolve => { secondStarted = resolve; });
  const original = storage.readChunk.bind(storage);
  jest.spyOn(storage, 'readChunk').mockImplementation(async (proto, file) => {
    if (file.name.endsWith('/0.chunk')) await firstGate;
    else secondStarted();
    return original(proto, file);
  });
  const iterator = storage.fileData(proto, token, 0, 20);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const first = iterator.next();
    await Promise.race([
      started,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Downloads did not overlap')), 3000); }),
    ]);
    releaseFirst();
    expect((await first).value).toEqual(content.subarray(0, 10));
    expect((await iterator.next()).value).toEqual(content.subarray(10));
    expect((await iterator.next()).done).toBe(true);
  } finally {
    clearTimeout(timer);
    releaseFirst();
    await iterator.return();
  }
});

test('finds the next open-ended chunk after an initially empty subrange', async () => {
  const content = randomBytes(50);
  const { storage, token } = fixture([30, 40], content);
  storage.options.chunkSize = 10;
  storage.options.listChunkBatchSize = 1;
  const chunks = [];
  for await (const chunk of storage.readChunks(proto, token, 0)) chunks.push(chunk.start);
  expect(chunks).toEqual([30, 40]);
});

test('rejects invalid listing batch sizes', async () => {
  const { storage, token } = fixture([0], Buffer.from('content'));
  storage.options.listChunkBatchSize = 0;
  await expect(read(storage, token)).rejects.toThrow('Invalid chunk listing batch size');
});

test('avoids listing unrelated chunks for a narrow range', async () => {
  const content = Buffer.alloc(10000, 1);
  const offsets = Array.from({ length: 1000 }, (_, i) => i * 10);
  const { storage, token, returned, queries } = fixture(offsets, content);
  expect(await read(storage, token, 5010, 5030)).toEqual(content.subarray(5010, 5030));
  expect(returned()).toBeLessThan(30);
  expect(queries.every(query => query.matchGlob)).toBe(true);
});

test('finds a nearby preceding Google Cloud chunk without a binary search', async () => {
  const chunkSize = 16 * 1024;
  const offsets = [0, 9 * chunkSize, 10 * chunkSize, 11 * chunkSize];
  const content = Buffer.alloc(12 * chunkSize, 1);
  const { storage, token, queries } = fixture(offsets, content);
  const start = 10 * chunkSize + 1;

  expect(await read(storage, token, start, start + 100)).toEqual(content.subarray(start, start + 100));
  expect(queries).toHaveLength(2);
});

test('falls back to finding a distant preceding Google Cloud chunk', async () => {
  const chunkSize = 16 * 1024;
  const content = randomBytes(6 * chunkSize);
  const { storage, token } = fixture([0, 5 * chunkSize], content);
  const start = 4 * chunkSize;

  expect(await read(storage, token, start, start + 100)).toEqual(content.subarray(start, start + 100));
});

function ossFixture(offsets: number[], content: Buffer) {
  const token = 'file';
  const files = offsets.map((start, index) => ({
    name: `${token}/${start}.chunk`,
    content: deflateSync(content.subarray(start, offsets[index + 1])),
  })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const queries: OSS.ListV2ObjectsQuery[] = [];
  let returned = 0;
  const client: OSS = Object.assign(Object.create(null), {
    listV2: async (query: OSS.ListV2ObjectsQuery) => {
      queries.push({ ...query });
      const matching = files.filter(file =>
        file.name.startsWith(query.prefix ?? '') &&
        (!query['start-after'] || file.name > query['start-after'])
      );
      const offset = Number(query['continuation-token'] ?? 0);
      const count = Math.min(Number(query['max-keys'] ?? 2), 2);
      const page = matching.slice(offset, offset + count);
      returned += page.length;
      const next = offset + count < matching.length ? String(offset + count) : null;
      return { objects: page, isTruncated: next !== null, nextContinuationToken: next };
    },
    get: async (name: string) => {
      const file = files.find(item => item.name === name);
      if (!file) throw Error('Missing chunk');
      return { content: file.content };
    },
  });
  return { token, storage: new AliyunObjectStorage(client), queries, returned: () => returned };
}

test('reads OSS ranges with paginated listings and exclusive start markers', async () => {
  const offsets = [0, 9, 80, 150, 240, 300, 999, 1000];
  const content = Buffer.from(Array.from({ length: 1300 }, (_, i) => i % 251));
  const { storage, token, queries } = ossFixture(offsets, content);

  expect(await read(storage, token, 100, 250)).toEqual(content.subarray(100, 250));
  expect(await read(storage, token, 150, 240)).toEqual(content.subarray(150, 240));
  expect(await read(storage, token, 950, 1010)).toEqual(content.subarray(950, 1010));
  expect(await read(storage, token, 1200, 1250)).toEqual(content.subarray(1200, 1250));
  expect(await read(storage, token, undefined, 81)).toEqual(content.subarray(0, 81));
  expect(await read(storage, token, 100)).toEqual(content.subarray(100));
  expect(queries.some(query => query['start-after'])).toBe(true);
  expect(queries.some(query => query['continuation-token'])).toBe(true);
});

test('finds a nearby preceding OSS chunk without a binary search', async () => {
  const chunkSize = 16 * 1024;
  const offsets = [0, 9 * chunkSize, 10 * chunkSize, 11 * chunkSize];
  const content = Buffer.alloc(12 * chunkSize, 1);
  const { storage, token, queries } = ossFixture(offsets, content);
  const start = 10 * chunkSize + 1;

  expect(await read(storage, token, start, start + 100)).toEqual(content.subarray(start, start + 100));
  expect(queries).toHaveLength(2);
});

test('avoids listing unrelated OSS chunks for a narrow range', async () => {
  const content = Buffer.alloc(10000, 1);
  const offsets = Array.from({ length: 1000 }, (_, i) => i * 10);
  const { storage, token, returned } = ossFixture(offsets, content);
  expect(await read(storage, token, 5010, 5030)).toEqual(content.subarray(5010, 5030));
  expect(returned()).toBeLessThan(30);
});

test('skips longer OSS offsets while searching shorter digit widths', async () => {
  const content = Buffer.alloc(102000, 1);
  const offsets = [0, 90, 200, 300, ...Array.from({ length: 2000 }, (_, i) => 100000 + i)];
  const { storage, token, returned } = ossFixture(offsets, content);
  expect(await read(storage, token, 100, 250)).toEqual(content.subarray(100, 250));
  expect(returned()).toBeLessThan(100);
});

test('reports truncated OSS listings without a continuation token', async () => {
  const client: OSS = Object.assign(Object.create(null), {
    listV2: async () => ({ objects: [], isTruncated: true, nextContinuationToken: null }),
  });
  await expect(read(new AliyunObjectStorage(client), 'file')).rejects.toThrow('Missing OSS continuation token');
});

test('selects filesystem chunks from a single directory listing', async () => {
  const content = Buffer.from(Array.from({ length: 1300 }, (_, i) => i % 251));
  const offsets = [0, 9, 80, 150, 240, 300, 999, 1000];
  await fs.mkdir('.temp', { recursive: true });
  const directory = await fs.mkdtemp(path.resolve('.temp/chunk-range-'));
  try {
    const storage = new FileSystemStorage(directory);
    for (const [index, start] of offsets.entries()) {
      const data = content.subarray(start, offsets[index + 1]);
      await storage.createChunk(proto, 'file', start, start + data.length, deflateSync(data));
    }
    const readdir = jest.spyOn(fs, 'readdir');
    try {
      expect(await read(storage, 'file', 100, 250)).toEqual(content.subarray(100, 250));
      expect(readdir).toHaveBeenCalledTimes(1);
      const selected = [];
      for await (const chunk of storage.listChunks(proto, 'file', 100, 250)) selected.push(chunk.start);
      expect(selected).toEqual([80, 150, 240]);
      const exact = [];
      for await (const chunk of storage.listChunks(proto, 'file', 150, 240)) exact.push(chunk.start);
      expect(exact).toEqual([80, 150]);
      const invalid = [];
      for await (const chunk of storage.listChunks(proto, 'file', 250, 100)) invalid.push(chunk.start);
      expect(invalid).toEqual(offsets);
      expect(await read(storage, 'file', 950, 1010)).toEqual(content.subarray(950, 1010));
      expect(await read(storage, 'file', 1200, 1250)).toEqual(content.subarray(1200, 1250));
      expect(await read(storage, 'file', 100)).toEqual(content.subarray(100));
      await fs.writeFile(path.join(directory, 'file', '0080.chunk'), deflateSync(content.subarray(80, 150)));
      const noncanonical = [];
      for await (const chunk of storage.listChunks(proto, 'file', 100, 250)) noncanonical.push(chunk.start);
      expect(noncanonical).toEqual([0, 9, 80, 80, 150, 240, 300, 999, 1000]);
      expect(await read(storage, 'file', 100, 250)).toEqual(content.subarray(100, 250));
    } finally {
      readdir.mockRestore();
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test.each(['google', 'aliyun', 'filesystem'] as const)('reads irregular chunk sizes with %s storage', async adapter => {
  const content = Buffer.from(Array.from({ length: 1400 }, (_, i) => i * 43 % 251));
  const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 90,
    ...Array.from({ length: 11 }, (_, i) => 200 + i), 400, 900, 999, 1000, 1200];
  let directory: string | undefined;
  try {
    let storage: FileStorageBase;
    let token: string;
    if (adapter === 'filesystem') {
      await fs.mkdir('.temp', { recursive: true });
      directory = await fs.mkdtemp(path.resolve('.temp/chunk-range-irregular-'));
      const filesystem = new FileSystemStorage(directory);
      for (const [index, start] of offsets.entries()) {
        const data = content.subarray(start, offsets[index + 1]);
        await filesystem.createChunk(proto, 'file', start, start + data.length, deflateSync(data));
      }
      storage = filesystem;
      token = 'file';
    } else {
      ({ storage, token } = adapter === 'google' ? fixture(offsets, content) : ossFixture(offsets, content));
    }
    storage.options.chunkSize = 100;

    for (const [start, end] of [[195, 220], [215, 220], [380, 405], [995, 1005], [1301, 1350], [0, 1400]]) {
      expect(await read(storage, token, start, end)).toEqual(content.subarray(start, end));
    }
    storage.options.listChunkBatchSize = 1;
    for (const start of [0, 8, 205, 380, 999, 1301, 1400, 1450]) {
      expect(await read(storage, token, start)).toEqual(content.subarray(start));
    }
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
});

test.each(['google', 'aliyun', 'filesystem'] as const)('reads randomized chunk sizes with %s storage', async adapter => {
  const chunkSize = 16 * 1204;
  let seed = 123456789;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const sizes = [1111, 568, 324, ...Array<number>(12).fill(1), chunkSize * 2 + 37,
    ...Array.from({ length: 120 }, () => random() % (chunkSize * 2) + 1)];
  const offsets: number[] = [];
  let length = 0;
  for (const size of sizes) {
    offsets.push(length);
    length += size;
  }
  const content = Buffer.from(Array.from({ length }, (_, i) => i * 43 % 251));
  let directory: string | undefined;
  try {
    let storage: GoogleCloudStorage | AliyunObjectStorage | FileSystemStorage;
    let token: string;
    if (adapter === 'filesystem') {
      await fs.mkdir('.temp', { recursive: true });
      directory = await fs.mkdtemp(path.resolve('.temp/chunk-range-random-'));
      const filesystem = new FileSystemStorage(directory);
      for (const [index, start] of offsets.entries()) {
        const data = content.subarray(start, offsets[index + 1]);
        await filesystem.createChunk(proto, 'file', start, start + data.length, deflateSync(data));
      }
      storage = filesystem;
      token = 'file';
    } else {
      ({ storage, token } = adapter === 'google' ? fixture(offsets, content) : ossFixture(offsets, content));
    }
    storage.options.chunkSize = chunkSize;

    const largeStart = offsets[15];
    const ranges = [
      [0, 1], [1110, 1112], [offsets[14] + 1, offsets[14] + 30],
      [largeStart + sizes[15] - 1, largeStart + sizes[15] + 1],
      [offsets[50], offsets[50] + 1], [length - 1, length],
    ];
    for (let i = 0; i < 20; i++) {
      const start = random() % length;
      ranges.push([start, Math.min(length, start + random() % (chunkSize * 3) + 1)]);
    }
    for (const [start, end] of ranges) {
      const previous = offsets.filter(offset => offset < start).pop();
      const expected = [...previous === undefined ? [] : [previous],
        ...offsets.filter(offset => offset >= start && offset < end)];
      const actual = [];
      for await (const chunk of storage.listChunks(proto, token, start, end)) actual.push(chunk.start);
      expect({ start, end, actual }).toEqual({ start, end, actual: expected });
      expect(await read(storage, token, start, end)).toEqual(content.subarray(start, end));
    }
    for (const start of [1110, largeStart + chunkSize + 1, length + 1]) {
      const actual = await read(storage, token, start);
      const expected = content.subarray(start);
      expect({ start, length: actual.length, matches: actual.equals(expected) })
        .toEqual({ start, length: expected.length, matches: true });
    }
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
});

test.each(['google', 'aliyun', 'filesystem'] as const)('reads full and partial 15 MiB random files with %s storage', async adapter => {
  const content = randomBytes(15 * 1024 * 1024 + 137);
  const chunkSize = 16 * 1024;
  const offsets = Array.from({ length: Math.ceil(content.length / chunkSize) }, (_, i) => i * chunkSize);
  let directory: string | undefined;
  try {
    let storage: FileStorageBase;
    let token: string;
    if (adapter === 'filesystem') {
      await fs.mkdir('.temp', { recursive: true });
      directory = await fs.mkdtemp(path.resolve('.temp/chunk-range-large-'));
      const filesystem = new FileSystemStorage(directory);
      for (const [index, start] of offsets.entries()) {
        const data = content.subarray(start, offsets[index + 1]);
        await filesystem.createChunk(proto, 'file', start, start + data.length, deflateSync(data));
      }
      storage = filesystem;
      token = 'file';
    } else {
      ({ storage, token } = adapter === 'google' ? fixture(offsets, content) : ossFixture(offsets, content));
    }

    expect((await read(storage, token)).equals(content)).toBe(true);
    const ranges = [
      [0, 1],
      [100, 250],
      [chunkSize - 32, chunkSize + 32],
      [9_999_900, 10_000_100],
      [content.length - 2 * chunkSize - 31, content.length - 15],
    ];
    for (let i = 0; i < 10; i++) {
      const start = randomInt(content.length);
      ranges.push([start, Math.min(start + randomInt(1, 2 * chunkSize + 1), content.length)]);
    }
    for (const [start, end] of ranges) {
      const matches = (await read(storage, token, start, end)).equals(content.subarray(start, end));
      expect({ start, end, matches }).toEqual({ start, end, matches: true });
    }
    const start = content.length - chunkSize - 1;
    expect((await read(storage, token, start)).equals(content.subarray(start))).toBe(true);
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
}, 30000);
