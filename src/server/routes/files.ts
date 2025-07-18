//
//  files.ts
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
import { Router } from '@o2ter/server-js';
import { Readable } from 'node:stream';
import { ProtoService } from '../proto';
import { decodeFormStream, response } from './common';
import { deserialize } from '../../internals/codec';
import { PVK } from '../../internals/private';
import { UPLOAD_TOKEN_HEADER_NAME } from '../../internals/const';
import { BinaryData } from '@o2ter/utils-js';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/files',
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      await response(res, async () => {

        const payload = proto.connect(req);
        const uploadToken = req.header(UPLOAD_TOKEN_HEADER_NAME);

        const { maxUploadSize } = payload[PVK].varifyUploadToken(payload, uploadToken, payload.isMaster);
        const { attributes, file } = await decodeFormStream(req, (file, info) => proto.fileStorage.create(proto, file, info, maxUploadSize));

        try {

          const obj = payload.Object('File');
          obj[PVK].mutated = _.mapValues(deserialize(attributes) as any, v => ({ $set: v })) as any;
          obj[PVK].extra.data = file;

          return obj.save({ master: payload.isMaster, uploadToken });

        } catch (e) {

          if (file?._id) proto[PVK].destroyFileData(proto, file._id);

          throw e;
        }
      });
    }
  );

  router.get(
    '/files/:id/:name',
    async (req, res, next) => {

      const { id, name } = req.params;

      const payload = proto.connect(req);
      const query = payload.Query('File').equalTo('_id', id);

      const file = await query.first({ master: payload.isMaster });
      if (!file || file.filename !== name) return void res.sendStatus(404);
      if (_.isNil(file.token) || _.isNil(file.size) || _.isNil(file.type)) return void res.sendStatus(404);

      const ranges = req.range(file.size);

      const match = req.headers['if-none-match'];
      if (match === `"${id}"`) {
        res.status(304).end();
        return;
      }
      res.setHeader('Content-Type', file.type);
      res.setHeader('Cache-Control', 'public, max-age=0');
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('ETag', `"${id}"`);

      let stream: AsyncIterable<BinaryData>;

      if (_.isArray(ranges) && ranges.type === 'bytes') {

        const startBytes = _.minBy(ranges, r => r.start)?.start ?? 0;
        const endBytes = _.maxBy(ranges, r => r.end)?.end ?? (file.size - 1);

        res.setHeader('Content-Length', endBytes - startBytes + 1);
        res.setHeader('Content-Range', `bytes ${startBytes}-${endBytes}/${file.size}`);
        res.status(206);

        stream = payload.fileStorage.fileData(payload, file.token, startBytes, endBytes + 1);

      } else {

        res.setHeader('Content-Length', file.size);
        res.status(200);

        stream = payload.fileStorage.fileData(payload, file.token);
      }

      Readable.from(stream).pipe(res).on('error', err => next(err));
    }
  );

  return router;
}