//
//  index.ts
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
import { ProtoService } from '../../../server/proto';
import OSS from 'ali-oss';
import { ChunkRange, FileChunkStorageBase, FileStorageOptions } from '../base';

export class AliyunObjectStorage extends FileChunkStorageBase<OSS.ObjectMeta> {

  private _storage: OSS;

  constructor(storage: OSS, options: FileStorageOptions = {}) {
    super(options);
    this._storage = storage;
  }

  async createChunk<E>(proto: ProtoService<E>, token: string, start: number, end: number, compressed: Buffer) {
    await this._storage.put(`${token}/${start}.chunk`, compressed);
  }

  async* listChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number) {
    const prefix = `${token}/`;
    const storage = this._storage;
    const list = async function* (range?: ChunkRange) {
      let next: string | undefined;
      // OSS start-after is exclusive, so stop just before the first chunk name.
      let after = range ? `${prefix}${range.low}.chun` : undefined;
      do {
        const result: OSS.ListObjectResult & { nextContinuationToken?: string | null } = await storage.listV2({
          prefix,
          delimiter: '/',
          'start-after': after,
          ...range?.firstOnly && { 'max-keys': '1' },
          'continuation-token': next,
        }, {});
        let skip: string | undefined;
        for (const item of result.objects ?? []) {
          if (range && item.name >= `${prefix}${range.high}.chunk~`) return;
          const name = item.name.slice(prefix.length);
          if (!/^\d+\.chunk$/.test(name)) continue;
          if (range && name.length > range.digits + 6) {
            // Longer offsets sharing these digits sort after the matching chunk.
            skip = `${prefix}${name.slice(0, range.digits)}~`;
            break;
          }
          const pos = parseInt(name.slice(0, -6));
          if (range && (name.length !== range.digits + 6 || pos < range.low || pos > range.high)) continue;
          yield { start: pos, file: item };
        }
        if (skip) {
          after = skip;
          next = undefined;
          continue;
        }
        if (result.isTruncated && !result.nextContinuationToken) throw Error('Missing OSS continuation token');
        next = result.nextContinuationToken ?? undefined;
        if (!next) break;
      } while (true);
    };
    yield* this.listChunkRange(list, start, end, this.options.chunkSize);
  }

  async readChunk<E>(proto: ProtoService<E>, file: OSS.ObjectMeta) {
    const { content } = await this._storage.get(file.name);
    return content;
  }

  async destroy<E>(proto: ProtoService<E>, token: string) {
    while (true) {
      const { objects } = await this._storage.listV2({
        prefix: `${token}/`,
        delimiter: '/',
      }, {});
      if (_.isEmpty(objects)) return;
      await this._storage.deleteMulti(_.map(objects, x => x.name));
    }
  }
};

export default AliyunObjectStorage;