//
//  index.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2023 O2ter Limited. All rights reserved.
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
import { Readable } from 'node:stream';
import { FileData, PVK, generateId } from '../../internals';
import { TFileStorage } from '../../server/filesys';
import { Proto } from '../../server';

export class MemoryFileStorage implements TFileStorage {

  _storage: Partial<Record<string, string | Buffer>> = {};

  async create<E>(
    proto: Proto<E>,
    file: FileData,
    info: {
      mimeType?: string;
      filename?: string;
    }
  ) {

    let buffer: string | Buffer;

    if (_.isString(file) || file instanceof Buffer) {
      buffer = file;
    } else if (file instanceof Blob) {
      buffer = Buffer.from(await file.arrayBuffer());
    } else if (file instanceof Readable) {
      const buffers = [];
      for await (const data of file) {
        buffers.push(data);
      }
      buffer = Buffer.concat(buffers);
    } else if ('base64' in file) {
      buffer = Buffer.from(file.base64, 'base64');
    } else {
      throw Error('Unknown file type');
    }

    const token = generateId(proto[PVK].options.objectIdSize);
    this._storage[token] = buffer;
    return {
      _id: token,
      size: buffer.length,
    };
  }

  async persist<E>(proto: Proto<E>, id: string) {
  }

  async destory<E>(proto: Proto<E>, id: string) {
    this._storage[id] = undefined;
  }

};

export default MemoryFileStorage;