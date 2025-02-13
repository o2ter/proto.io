//
//  index.ts
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
import { ProtoService } from '../../../server/proto';
import OSS from 'ali-oss';
import { FileChunkStorageBase, FileStorageOptions } from '../base';

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
    let next: string | undefined;
    do {
      const { objects, nextContinuationToken } = await (this._storage as any).listV2({
        prefix: `${token}/`,
        delimiter: '/',
        continuationToken: next,
      }, {});
      if (_.isEmpty(objects)) break;
      for (const item of objects) {
        const name = _.last(_.split(item.name, '/'));
        if (!name?.match(/^\d+\.chunk$/)) continue;
        const pos = parseInt(name.slice(0, -6));
        if (start && pos < start) continue;
        if (end && pos >= end) continue;
        yield { start: pos, file: item };
      }
      next = nextContinuationToken;
    } while (next);
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