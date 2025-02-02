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
import { Storage, File } from '@google-cloud/storage';
import { FileStorageOptions } from '../base';
import { FileChunkStorageBase } from '../base/chunk';

export class GoogleCloudStorage extends FileChunkStorageBase<File> {

  private _storage: Storage;
  private _bucket: string;

  constructor(storage: Storage, bucket: string, options: FileStorageOptions = {}) {
    super(options);
    this._storage = storage;
    this._bucket = bucket;
  }

  get bucket() {
    return this._storage.bucket(this._bucket);
  }

  async createChunk<E>(proto: ProtoService<E>, token: string, start: number, end: number, compressed: Buffer) {
    await this.bucket.file(`${token}/${start}.chunk`).save(compressed);
  }

  async listChunks<E>(proto: ProtoService<E>, token: string) {
    const [response] = await this.bucket.getFiles({
      prefix: `${token}/`,
      delimiter: '/',
    });
    const files = _.map(response, x => ({
      file: x,
      name: _.last(_.split(x.name, '/'))!,
    }));
    return _.map(_.filter(files, x => !!x.name?.match(/^\d+\.chunk$/)), x => ({
      ...x,
      start: parseInt(x.name.slice(0, -6)),
    }));
  }

  async readChunk<E>(proto: ProtoService<E>, name: string, file: File) {
    const [buffer] = await file.download() ?? [];
    if (!buffer) throw Error('Unable to connect cloud storage');
    return buffer;
  }

  async destroy<E>(proto: ProtoService<E>, token: string) {
    await this.bucket.deleteFiles({ prefix: `${token}/` });
  }
};

export default GoogleCloudStorage;