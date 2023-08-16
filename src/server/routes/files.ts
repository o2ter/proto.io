//
//  files.ts
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
import { Router } from 'express';
import { Readable } from 'node:stream';
import { ProtoService } from '../proto';
import { decodeFormStream, response } from './common';
import { FileBuffer, PVK, deserialize } from '../../internals';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/files',
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      await response(res, async () => {

        const { attributes, file } = await decodeFormStream(req, (file, info) => proto.fileStorage.create(proto, file, info));

        try {

          const payload = proto.connect(req);
          const obj = payload.Object('File');
          obj[PVK].mutated = _.mapValues(deserialize(attributes) as any, v => ({ $set: v })) as any;
          obj[PVK].extra.data = file;

          return obj.save({ master: payload.isMaster });

        } catch (e) {

          if (file?._id) proto[PVK].destoryFileData(proto, file._id);

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
      const query = payload.Query('File', { master: payload.isMaster }).equalTo('_id', id);

      const file = await query.first();
      if (!file || file.filename !== name) return res.sendStatus(404);
      if (_.isNil(file.token) || _.isNil(file.size) || _.isNil(file.type)) return res.sendStatus(404);

      const location = await payload.fileStorage.fileLocation(payload, file.token);
      if (location) return res.redirect(location);

      const ranges = req.range(file.size);

      const match = req.headers['if-none-match'];
      if (match === `"${id}"`) {
        res.status(304).end();
        return;
      }
      res.setHeader('Content-Type', file.type);
      res.setHeader('Cache-Control', 'public, max-age=0');
      res.setHeader('ETag', `"${id}"`);

      let stream: AsyncIterable<FileBuffer>;

      if (_.isArray(ranges) && ranges.type === 'bytes') {

        const startBytes = _.minBy(ranges, r => r.start)?.start ?? 0;
        const endBytes = _.maxBy(ranges, r => r.end)?.end ?? file.size;

        res.setHeader('Content-Range', `bytes ${startBytes}-${endBytes}/${file.size}`);
        res.status(206);

        stream = payload.fileStorage.fileData(payload, file.token, startBytes, endBytes);

      } else {

        res.status(200);

        stream = payload.fileStorage.fileData(payload, file.token);
      }

      const _stream = Readable.from(stream);
      _stream.on('error', err => next(err));
      _stream.pipe(res);
    }
  );

  return router;
}