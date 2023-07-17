//
//  classes.ts
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
import { deserialize } from '../codec';
import { response } from './common';

export default (router: Router, payload: Proto) => {

  router.post(
    '/classes/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name } = req.params;
      const models = await payload.models();

      if (!_.includes(models, name)) return res.sendStatus(404);

      await response(res, async () => {

        const {
          operation = 'insert',
          attributes,
          update,
          setOnInsert,
          ...options
        }: any = deserialize(req.body);

        const _payload = Object.setPrototypeOf({
          ..._.omit(req, 'body'),
        }, payload);
        const query = _payload.query(name);
        query.options = options;

        switch (operation) {
          case 'count': return query.count();
          case 'find': return await query;
          case 'insert': return query.insert(attributes);
          case 'findOneAndUpdate': return query.findOneAndUpdate(update);
          case 'findOneAndUpsert': return query.findOneAndUpsert(update, setOnInsert);
          case 'findOneAndDelete': return query.findOneAndDelete();
          case 'findAndDelete': return query.findAndDelete();
          default: throw new Error('Invalid operation');
        }
      });
    }
  );

  router.get(
    '/classes/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name } = req.params;
      const models = await payload.models();

      if (!_.includes(models, name)) return res.sendStatus(404);

      await response(res, async () => {

      });
    }
  );

  router.get(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { name, id } = req.params;
      const models = await payload.models();

      if (!_.includes(models, name)) return res.sendStatus(404);

      const _payload = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, payload);
      const query = _payload.query(name).filter({ _id: id }).limit(1);

      await response(res, async () => {
        const [obj] = await query;
        return obj;
      });
    }
  );

  router.put(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name, id } = req.params;
      const models = await payload.models();

      if (!_.includes(models, name)) return res.sendStatus(404);

      const _payload = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, payload);
      const query = _payload.query(name).filter({ _id: id }).limit(1);

      await response(res, async () => query.findOneAndUpdate(deserialize(req.body)));
    }
  );

  router.delete(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { name, id } = req.params;
      const models = await payload.models();

      if (!_.includes(models, name)) return res.sendStatus(404);

      const _payload = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, payload);
      const query = _payload.query(name).filter({ _id: id });

      await response(res, async () => query.findOneAndDelete());
    }
  );

  return router;
}