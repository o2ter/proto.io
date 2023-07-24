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
import { FileBuffer, FileData, PVK, TSchema, base64ToBuffer, fileBufferSize, isFileBuffer } from '../../internals';
import { TFileStorage } from '../../server/filesys';
import { Proto } from '../../server';

export class DatabaseFileStorage implements TFileStorage {

  get schema(): Record<string, TSchema> {
    return {
      '_FileChunk': {
        fields: {
          token: 'string',
          offset: 'number',
          size: 'number',
          content: 'string',
        },
        classLevelPermissions: {
          find: [],
          count: [],
          create: [],
          update: [],
          delete: [],
        },
        indexes: [
          { keys: { token: 1, offset: 1 } },
        ]
      },
    }
  }

  async createWithStream<E>(
    proto: Proto<E>,
    file: Readable,
  ) {

    const token = proto[PVK].generateId();
    let size = 0;

    for await (const data of file) {

      const chunkSize = fileBufferSize(data);

      const created = await proto.Query('_FileChunk', { master: true }).insert({ token, offset: size, size: chunkSize, content: data });
      if (!created) throw Error('Unable to save file');
  
      size += chunkSize;
      if (size > proto[PVK].options.maxUploadSize) throw Error('Payload too large');
    }

    return { _id: token, size };
  }

  async create<E>(
    proto: Proto<E>,
    file: FileData,
  ) {

    if (file instanceof Readable) {
      return this.createWithStream(proto, file);
    }

    let buffer: string | FileBuffer;

    if (_.isString(file) || isFileBuffer(file)) {
      buffer = file;
    } else if ('base64' in file) {
      buffer = base64ToBuffer(file.base64);
    } else {
      throw Error('Unknown file type');
    }

    const token = proto[PVK].generateId();
    const size = _.isString(buffer) ? buffer.length : fileBufferSize(buffer);

    if (size > proto[PVK].options.maxUploadSize) throw Error('Payload too large');

    const created = await proto.Query('_FileChunk', { master: true }).insert({ token, offset: 0, size, content: buffer });
    if (!created) throw Error('Unable to save file');

    return { _id: token, size };
  }

  async destory<E>(proto: Proto<E>, id: string) {
    await proto.Query('_FileChunk', { master: true }).filter({ token: id }).findAndDelete();
  }

};

export default DatabaseFileStorage;