//
//  function.ts
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
import { Server, Router } from '@o2ter/server-js';
import { ProtoService } from '../proto';
import { response } from './common';
import { deserialize } from '../../common';
import { PVK } from '../../internals/private';
import { TObject } from '../../internals/object';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/functions/:name',
    Server.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name } = req.params;
      if (_.isNil(proto[PVK].functions[name])) return void res.sendStatus(404);

      await response(res, () => {

        const payload = proto.connect(req, x => ({
          params: x.rebind(deserialize(req.body, { objAttrs: TObject.defaultReadonlyKeys })),
        }));

        return payload[PVK].run(payload, name, payload, { master: payload.isMaster });
      });
    }
  );

  return router;
}