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
import express, { Router } from 'express';
import { Proto } from '../../server';
import { decodeFormStream, response } from './common';
import { PVK, UpdateOp, deserialize } from '../../internals';

export default <E>(router: Router, proto: Proto<E>) => {

  router.post(
    '/files',
    async (req, res) => {

      await response(res, async () => {

        const { attributes, file } = await decodeFormStream(req, (file, info) => proto.fileStorage.create(proto, file, info));

        try {

          const obj = proto.Object('_File');
          obj[PVK].mutated = _.mapValues(deserialize(attributes) as any, v => [UpdateOp.set, v]) as any;
          obj[PVK].extra.data = file;

          return obj.save();

        } catch (e) {

          if (file?._id) proto[PVK].destoryFileData(proto, file._id);

          throw e;
        }
      });
    }
  );

  router.delete(
    '/files/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { id } = req.params;

      const payload: Proto<E> = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, proto);
      const query = payload.Query('_File').filter({ _id: id });

      await response(res, async () => query.findOneAndDelete());
    }
  );

  return router;
}