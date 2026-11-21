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

test('separates cached listings for different ranges', async () => {
  jest.useFakeTimers();
  try {
    const content = Buffer.from(Array.from({ length: 400 }, (_, i) => i % 251));
    const { storage, token } = fixture([0, 100, 200, 300], content, 1000);
    expect(await read(storage, token, 10, 50)).toEqual(content.subarray(10, 50));
    expect(await read(storage, token, 210, 250)).toEqual(content.subarray(210, 250));
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
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
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([[3, 23]]);
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
    [10, 30], [30, 50], [50, Number.MAX_SAFE_INTEGER],
    [90, 110], [110, 130], [130, 150], [150, Number.MAX_SAFE_INTEGER],
  ]);
  list.mockClear();
  expect(await read(storage, token, 10)).toEqual(content.subarray(10));
  list.mockClear();
  expect(await read(storage, token, 137)).toEqual(Buffer.alloc(0));
  expect(list.mock.calls.map(call => call.slice(2))).toEqual([
    [137, 157], [157, 177], [177, Number.MAX_SAFE_INTEGER],
  ]);
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
      expect(await read(storage, 'file', 950, 1010)).toEqual(content.subarray(950, 1010));
      expect(await read(storage, 'file', 1200, 1250)).toEqual(content.subarray(1200, 1250));
      expect(await read(storage, 'file', 100)).toEqual(content.subarray(100));
      await fs.writeFile(path.join(directory, 'file', '0080.chunk'), deflateSync(content.subarray(80, 150)));
      const noncanonical = [];
      for await (const chunk of storage.listChunks(proto, 'file', 100, 250)) noncanonical.push(chunk.start);
      expect(noncanonical).toEqual([0, 9, 80, 80, 150, 240, 300, 999, 1000]);
    } finally {
      readdir.mockRestore();
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
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
