//
//  object.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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

export abstract class FileChunkStorageBase<File> extends FileStorageBase {

  abstract listChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number): AsyncGenerator<{
    start: number;
    file: File;
  }>;

  abstract readChunk<E>(proto: ProtoService<E>, file: File): PromiseLike<Buffer>;

  async* readChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number) {
    const streams = await asyncIterableToArray(this.listChunks(proto, token, start, end));
    const files = _.orderBy(streams, x => x.start);
    for (const [chunk, endBytes] of _.zip(files, _.slice(_.map(files, x => x.start), 1))) {
      if (_.isNumber(start) && _.isNumber(endBytes) && start >= endBytes) continue;
      if (_.isNumber(end) && end <= chunk!.start) continue;
      if (!chunk) continue;
      yield {
        start: chunk.start,
        data: (async () => this.readChunk(proto, chunk.file))(),
      };
    }
  }
}