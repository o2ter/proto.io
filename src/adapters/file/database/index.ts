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
import { deflate, unzip } from 'node:zlib';
import { FileBuffer, FileData, PVK, TSchema, base64ToBuffer, bufferToBase64, isFileBuffer } from '../../../internals';
import { TFileStorage } from '../../../server/filesys';
import { Proto } from '../../../server';

const streamChunk = (stream: Readable, chunkSize: number) => Readable.from({
  [Symbol.asyncIterator]: async function* () {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.byteLength >= chunkSize) {
        yield buffer.subarray(0, chunkSize);
        buffer = buffer.subarray(chunkSize);
      }
    }
    yield buffer;
  },
});

export class DatabaseFileStorage implements TFileStorage {

  chunkSize: number;

  constructor(chunkSize: number = 16 * 1024) {
    this.chunkSize = chunkSize;
  }

  get schema(): Record<string, TSchema> {
    return {
      '_FileChunk': {
        fields: {
          token: 'string',
          start: 'number',
          end: 'number',
          size: 'number',
          base64: 'string',
        },
        classLevelPermissions: {
          find: [],
          count: [],
          create: [],
          update: [],
          delete: [],
        },
        indexes: [
          { keys: { token: 1, start: 1, end: 1 } },
          { keys: { token: 1, end: 1 } },
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

    const maxUploadSize = _.isFunction(proto[PVK].options.maxUploadSize) ? await proto[PVK].options.maxUploadSize(proto) : proto[PVK].options.maxUploadSize;

    for await (const data of streamChunk(file, this.chunkSize)) {

      const chunkSize = data.byteLength;
      const compressed: Buffer = await new Promise((resolve, rejected) => deflate(data, (err, buffer) => {
        if (err) {
          rejected(err);
        } else {
          resolve(buffer);
        }
      }));

      const created = await proto.Query('_FileChunk', { master: true }).insert({
        token,
        start: size,
        end: size + chunkSize,
        size: chunkSize,
        base64: bufferToBase64(compressed),
      });
      if (!created) throw Error('Unable to save file');

      size += chunkSize;
      if (size > maxUploadSize) throw Error('Payload too large');
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
    const size = _.isString(buffer) ? buffer.length : buffer.byteLength;

    const maxUploadSize = _.isFunction(proto[PVK].options.maxUploadSize) ? await proto[PVK].options.maxUploadSize(proto) : proto[PVK].options.maxUploadSize;

    if (size > maxUploadSize) throw Error('Payload too large');

    const created = await proto.Query('_FileChunk', { master: true }).insert({
      token,
      start: 0,
      end: size,
      size,
      base64: bufferToBase64(buffer),
    });
    if (!created) throw Error('Unable to save file');

    return { _id: token, size };
  }

  async destory<E>(proto: Proto<E>, id: string) {
    await proto.Query('_FileChunk', { master: true }).equalTo('token', id).findAndDelete();
  }

  async* fileData<E>(proto: Proto<E>, id: string, start?: number, end?: number) {

    const query = proto.Query('_FileChunk', { master: true })
      .sort({ start: 1 })
      .filter({
        token: { $eq: id },
        ...start ? { end: { $gt: start } } : {},
        ...end ? { start: { $lt: end } } : {},
      });

    for await (const chunk of query.find()) {

      const startBytes = chunk.get('start');
      const endBytes = chunk.get('end');
      const base64 = chunk.get('base64');

      if (!_.isNumber(startBytes) || !_.isNumber(endBytes) || !_.isString(base64)) throw Error('Corrupted data');

      const data = base64ToBuffer(base64);
      const uncompressed: Buffer = await new Promise((resolve, rejected) => unzip(data, (err, buffer) => {
        if (err) {
          rejected(err);
        } else {
          resolve(buffer);
        }
      }));

      if (_.isNumber(start) || _.isNumber(end)) {

        const _start = _.isNumber(start) && start > startBytes ? start - startBytes : 0;
        const _end = _.isNumber(end) && end < endBytes ? end - startBytes : undefined;

        yield uncompressed.subarray(_start, _end);

      } else {

        yield uncompressed;
      }

    }

  }

  async fileLocation<E>(proto: Proto<E>, id: string) {
    return undefined;
  }

};

export default DatabaseFileStorage;