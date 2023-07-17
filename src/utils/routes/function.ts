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
import { Proto } from '../types';
import { serialize, deserialize } from '../codec';
import { response } from './common';

export default (router: Router, payload: Proto) => {

  const { functions } = payload;
  if (_.isEmpty(functions)) return router;

  router.post(
    '/functions/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name } = req.params;
      if (_.isNil(functions[name])) return res.sendStatus(404);

      await response(res, async () => {

        const data = deserialize(req.body);
        const _payload = Object.setPrototypeOf({
          ..._.omit(req, 'body'),
          data: data ?? null,
        }, payload);

        return _payload._run(name);
      });
    }
  );

  return router;
}