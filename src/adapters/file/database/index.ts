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
import { deflate, unzip } from 'zlib';
import { PVK, base64ToBuffer, bufferToBase64 } from '../../../internals';
import { TFileStorage } from '../../../server/file';
import { ProtoService } from '../../../server/proto';
import { TSchema } from '../../../internals/schema';
import { streamChunk } from '../../../server/file/stream';

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
          get: [],
          find: [],
          count: [],
          create: [],
          update: [],
          delete: [],
        },
        fieldLevelPermissions: {
          _expired_at: { create: [], update: [] },
        },
        indexes: [
          { keys: { token: 1, start: 1, end: 1 } },
          { keys: { token: 1, end: 1 } },
        ]
      },
    }
  }

  async create<E>(
    proto: ProtoService<E>,
    stream: BinaryData | AsyncIterable<BinaryData>,
  ) {

    const token = proto[PVK].generateId();
    let size = 0;

    const maxUploadSize = _.isFunction(proto[PVK].options.maxUploadSize) ? await proto[PVK].options.maxUploadSize(proto) : proto[PVK].options.maxUploadSize;

    for await (const data of streamChunk(stream, this.chunkSize)) {

      const chunkSize = data.byteLength;
      const compressed = await promisify(deflate)(data);

      const created = await proto.Query('_FileChunk').insert({
        token,
        start: size,
        end: size + chunkSize,
        size: chunkSize,
        base64: bufferToBase64(compressed),
      }, { master: true });
      if (!created) throw Error('Unable to save file');

      size += chunkSize;
      if (size > maxUploadSize) throw Error('Payload too large');
    }

    return { _id: token, size };
  }

  async destory<E>(proto: ProtoService<E>, id: string) {
    await proto.Query('_FileChunk').equalTo('token', id).deleteMany({ master: true });
  }

  async* fileData<E>(proto: ProtoService<E>, id: string, start?: number, end?: number) {

    const query = proto.Query('_FileChunk')
      .sort({ start: 1 })
      .filter({
        token: { $eq: id },
        ...start ? { end: { $gt: start } } : {},
        ...end ? { start: { $lt: end } } : {},
      });

    for await (const chunk of query.find({ master: true })) {

      const startBytes = chunk.get('start');
      const endBytes = chunk.get('end');
      const base64 = chunk.get('base64');

      if (!_.isNumber(startBytes) || !_.isNumber(endBytes) || !_.isString(base64)) throw Error('Corrupted data');

      const data = base64ToBuffer(base64);
      const uncompressed = await promisify(unzip)(data);

      if (_.isNumber(start) || _.isNumber(end)) {

        const _start = _.isNumber(start) && start > startBytes ? start - startBytes : 0;
        const _end = _.isNumber(end) && end < endBytes ? end - startBytes : undefined;

        yield uncompressed.subarray(_start, _end);

      } else {

        yield uncompressed;
      }

    }

  }

};

export default DatabaseFileStorage;