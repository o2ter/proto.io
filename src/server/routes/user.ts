//
//  user.ts
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
import { ProtoService } from '../proto';
import { response } from './common';
import { deserialize } from 'bson';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.get(
    '/user/me',
    async (req: any, res) => {
      res.setHeader('Cache-Control', ['no-cache', 'no-store']);
      const payload = proto.connect(req);
      await response(res, () => payload.user());
    }
  );

  router.post(
    '/user/:id/password',
    express.text({ type: '*/*' }),
    async (req: any, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { id } = req.params;
      const payload = proto.connect(req);

      await response(res, async () => {

        if (!payload.isMaster) throw Error('No permission');

        const user = await payload.Query('User', { master: true }).get(id);
        if (!user) throw Error('User not found');

        const { password } = _.isEmpty(req.body) ? { password: null } : deserialize(req.body) as any;
        if (_.isEmpty(password)) {
          await payload.unsetPassword(user, { master: true });
        } else {
          await payload.setPassword(user, password, { master: true });
        }
      });
    }
  );

  router.post(
    '/user/logout',
    async (req: any, res) => {
      res.setHeader('Cache-Control', ['no-cache', 'no-store']);
      const payload = proto.connect(req);
      await response(res, () => payload.logoutUser(req));
    }
  );

  return router;
}