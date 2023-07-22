//
//  function.ts
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
import { deserialize } from '../../common/codec';
import { response } from './common';
import { PVK } from '../../common/private';
import { applyObjectMethods } from '../../common/object/methods';

export default <E>(router: Router, payload: Proto<E>) => {

  router.post(
    '/functions/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name } = req.params;
      if (_.isNil(payload[PVK].functions[name])) return res.sendStatus(404);

      await response(res, async () => {

        const _payload = Object.setPrototypeOf({
          ..._.omit(req, 'body'),
        }, payload);
        _payload.data = applyObjectMethods(deserialize(req.body), _payload);

        return _payload[PVK].run(name, _payload);
      });
    }
  );

  return router;
}