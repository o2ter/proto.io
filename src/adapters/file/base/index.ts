//
//  index.ts
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
import { promisify } from 'util';
import { deflate as _deflate, unzip as _unzip } from 'zlib';
import { TFileInfo, TFileStorage } from '../../../server/file';
import { ProtoService } from '../../../server/proto';
import { TSchema } from '../../../internals/schema';
import { BinaryData, binaryStreamChunk, parallelEach, parallelMap } from '@o2ter/utils-js';
import { PVK } from '../../../internals/private';

const deflate = promisify(_deflate);
const unzip = promisify(_unzip);

export type FileStorageOptions = {
  chunkSize?: number;
  parallel?: number;
};

export abstract class FileStorageBase implements TFileStorage {

  options: Required<FileStorageOptions>;

  constructor(options: FileStorageOptions) {
    this.options = {
      chunkSize: 16 * 1024,
      parallel: 8,
      ..._.pickBy(options, v => !_.isNil(v)),
    };
  }

  get schema(): Record<string, TSchema> {
    return {}
  }

  abstract createChunk<E>(proto: ProtoService<E>, token: string, start: number, end: number, compressed: Buffer): PromiseLike<void>;
  abstract readChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number): AsyncGenerator<{
    start: number;
    data: Buffer | Uint8Array | PromiseLike<Buffer | Uint8Array>;
  }, void>;
  abstract destroy<E>(proto: ProtoService<E>, id: string): PromiseLike<void>;

  async create<E>(
    proto: ProtoService<E>,
    stream: BinaryData | AsyncIterable<BinaryData>,
    info: TFileInfo,
    maxUploadSize: number,
  ) {

    const token = proto[PVK].generateId();

    let size = 0;
    const _stream = async function* (stream: AsyncIterable<Buffer>) {
      for await (const data of stream) {
        yield { data, offset: size };
        size += data.byteLength;
      }
    };

    await parallelEach(
      _stream(binaryStreamChunk(stream, this.options.chunkSize)),
      this.options.parallel,
      async ({ data, offset }) => {
        const chunkSize = data.byteLength;
        await this.createChunk(proto, token, offset, offset + chunkSize, await deflate(data));
        if (offset + chunkSize > maxUploadSize) throw Error('Payload too large');
      }
    );

    return { _id: token, size };
  }

  async* fileData<E>(proto: ProtoService<E>, id: string, start?: number, end?: number) {

    const _stream = parallelMap(
      this.readChunks(proto, id, start, end),
      this.options.parallel,
      async chunk => ({
        start: chunk.start,
        data: await unzip(await chunk.data),
      })
    );

    for await (const { start: startBytes, data } of _stream) {

      if (!_.isNumber(start) && !_.isNumber(end)) {

        yield data;

      } else {

        const endBytes = startBytes + data.length;
        const _start = _.isNumber(start) && start > startBytes ? start - startBytes : 0;
        const _end = _.isNumber(end) && end < endBytes ? end - startBytes : undefined;

        yield data.subarray(_start, _end);
      }
    }
  }
};

export default FileStorageBase;