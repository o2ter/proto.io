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
import { ProtoService } from '../../../server/proto';
import { TSchema } from '../../../internals/schema';
import FileStorageBase, { FileStorageOptions } from '../base';
import { QuerySelector } from '../../../server/query/dispatcher/parser';
import { base64ToBuffer, bufferToBase64 } from '@o2ter/utils-js';

export class DatabaseFileStorage extends FileStorageBase {

  constructor(options: FileStorageOptions = {}) {
    super(options);
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

  async createChunk<E>(proto: ProtoService<E>, token: string, start: number, end: number, compressed: Buffer) {

    const created = await proto.Query('_FileChunk').insert({
      token,
      start: start,
      end: end,
      size: end - start,
      base64: bufferToBase64(compressed),
    }, { master: true });

    if (!created) throw Error('Unable to save file');

  }

  async* readChunks<E>(proto: ProtoService<E>, token: string, start?: number | undefined, end?: number | undefined) {
    const query = proto.Query('_FileChunk')
      .sort({ start: 1 })
      .filter({
        token: { $eq: token },
        ...start ? { end: { $gt: start } } : {},
        ...end ? { start: { $lt: end } } : {},
      });
    for await (const chunk of query.find({ master: true })) {
      const startBytes = chunk.get('start');
      const base64 = chunk.get('base64');
      if (!_.isNumber(startBytes) || !_.isString(base64)) throw Error('Corrupted data');
      yield {
        start: startBytes,
        data: base64ToBuffer(base64),
      };
    }
  }

  async destory<E>(proto: ProtoService<E>, token: string) {
    proto.storage.deleteMany({
      className: '_FileChunk',
      filter: QuerySelector.decode({ token: { $eq: token } }),
      includes: ['_id'],
      matches: {},
      objectIdSize: 0
    });
  }
};

export default DatabaseFileStorage;