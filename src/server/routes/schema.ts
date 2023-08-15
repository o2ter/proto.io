//
//  schema.ts
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
import { ProtoService } from '../proto';
import { response } from './common';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.get(
    '/schema',
    async (req: any, res) => {
      res.setHeader('Cache-Control', ['no-cache', 'no-store']);
      const payload = proto.connect(req);
      await response(res, () => {
        if (!payload.isMaster) throw Error('No permission');
        return payload.schema as any;
      });
    }
  );

  router.get(
    '/schema/:name',
    async (req: any, res) => {
      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name } = req.params;
      if (_.isNil(proto.schema[name])) return res.sendStatus(404);

      const payload = proto.connect(req);
      await response(res, () => {
        if (!payload.isMaster) throw Error('No permission');
        return payload.schema[name] as any;
      });
    }
  );

  return router;
}