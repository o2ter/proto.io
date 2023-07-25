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
import { Proto } from '../../server';
import queryType from 'query-types';
import { response } from './common';
import { PVK, UpdateOp, deserialize } from '../../internals';

export default <E>(router: Router, proto: Proto<E>) => {

  router.post(
    '/classes/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      await response(res, async () => {

        const {
          operation = 'insert',
          attributes,
          update,
          replacement,
          setOnInsert,
          ...options
        }: any = deserialize(req.body);

        const payload: Proto<E> = Object.setPrototypeOf({
          ..._.omit(req, 'body'),
        }, proto);
        const query = payload.Query(name);
        query[PVK].options = options;

        switch (operation) {
          case 'explain': return query.explain();
          case 'count': return query.count();
          case 'find': return await query.find();
          case 'insert': return query.insert(attributes);
          case 'findOneAndUpdate': return query.findOneAndUpdate(update);
          case 'findOneAndReplace': return query.findOneAndReplace(replacement);
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
    queryType.middleware(),
    async (req, res) => {

      const { name } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const query = proto.Query(name);

      await response(res, async () => {

        const {
          filter,
          sort,
          includes,
          skip,
          limit,
          returning,
        } = req.query;

        query[PVK].options.filter = _.isEmpty(filter) && _.isString(filter) ? _.castArray(deserialize(filter)) as any : [];
        query[PVK].options.sort = _.isPlainObject(sort) && _.every(_.values(sort), _.isNumber) ? sort as any : undefined;
        query[PVK].options.includes = _.isArray(includes) && _.every(includes, _.isString) ? includes as any : undefined;
        query[PVK].options.skip = _.isNumber(skip) ? skip : undefined;
        query[PVK].options.limit = _.isNumber(limit) ? limit : undefined;
        query[PVK].options.returning = _.includes(['old', 'new'], returning) ? returning as any : undefined;

        return await query.find();
      });
    }
  );

  router.get(
    '/classes/:name/:id',
    async (req, res) => {

      const { name, id } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload: Proto<E> = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, proto);

      await response(res, async () => payload.Query(name).get(id));
    }
  );

  router.put(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name, id } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload: Proto<E> = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, proto);
      const query = payload.Query(name).equalTo('_id', id);

      await response(res, async () => query.findOneAndReplace(deserialize(req.body) as any));
    }
  );

  router.patch(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      const { name, id } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload: Proto<E> = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, proto);
      const query = payload.Query(name).equalTo('_id', id);

      const update = _.mapValues(deserialize(req.body) as any, v => [UpdateOp.set, v]);
      await response(res, async () => query.findOneAndUpdate(update as any));
    }
  );

  router.delete(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { name, id } = req.params;
      const classes = await proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload: Proto<E> = Object.setPrototypeOf({
        ..._.omit(req, 'body'),
      }, proto);
      const query = payload.Query(name).equalTo('_id', id);

      await response(res, async () => query.findOneAndDelete());
    }
  );

  return router;
}