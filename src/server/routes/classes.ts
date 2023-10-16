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
import { ProtoService } from '../proto';
import queryType from 'query-types';
import { response } from './common';
import { PVK, deserialize } from '../../internals';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/classes/:name',
    express.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      await response(res, async () => {

        const {
          operation,
          context,
          random,
          attributes,
          update,
          replacement,
          setOnInsert,
          ...options
        } = deserialize(req.body) as any;

        const payload = proto.connect(req);
        const query = payload.Query(name, { master: payload.isMaster, context });
        query[PVK].options = options;

        switch (operation) {
          case 'explain':
            if (!payload.isMaster) throw Error('No permission');
            return query.explain();
          case 'count': return query.count();
          case 'find':
            {
              const maxFetchLimit = _.isFunction(payload[PVK].options.maxFetchLimit) ? await payload[PVK].options.maxFetchLimit(payload) : payload[PVK].options.maxFetchLimit;
              query[PVK].options.limit = query[PVK].options.limit ?? maxFetchLimit;
              if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
              return await query.find();
            }
          case 'random':
            {
              const maxFetchLimit = _.isFunction(payload[PVK].options.maxFetchLimit) ? await payload[PVK].options.maxFetchLimit(payload) : payload[PVK].options.maxFetchLimit;
              query[PVK].options.limit = query[PVK].options.limit ?? maxFetchLimit;
              if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
              return await query.random(random);
            }
          case 'insert': return query.insert(attributes);
          case 'updateOne': return query.updateOne(update);
          case 'upsertOne': return query.upsertOne(update, setOnInsert);
          case 'deleteOne': return query.deleteOne();
          case 'deleteMany': return query.deleteMany();
          default: throw Error('Invalid operation');
        }
      });
    }
  );

  router.get(
    '/classes/:name',
    queryType.middleware(),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);
      const query = payload.Query(name, { master: payload.isMaster });

      await response(res, async () => {

        const {
          filter,
          sort,
          includes,
          skip,
          limit,
        } = req.query;

        const maxFetchLimit = _.isFunction(payload[PVK].options.maxFetchLimit) ? await payload[PVK].options.maxFetchLimit(payload) : payload[PVK].options.maxFetchLimit;

        query[PVK].options.filter = !_.isEmpty(filter) && _.isString(filter) ? _.castArray(deserialize(filter)) as any : [];
        query[PVK].options.sort = _.isPlainObject(sort) && _.every(_.values(sort), _.isNumber) ? sort as any : undefined;
        query[PVK].options.includes = _.isArray(includes) && _.every(includes, _.isString) ? includes as any : undefined;
        query[PVK].options.skip = _.isNumber(skip) ? skip : undefined;
        query[PVK].options.limit = _.isNumber(limit) ? limit : maxFetchLimit;

        if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
        return await query.find();
      });
    }
  );

  router.get(
    '/classes/:name/:id',
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name, id } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);

      await response(res, () => payload.Query(name, { master: payload.isMaster }).get(id));
    }
  );

  router.patch(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name, id } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);
      const query = payload.Query(name, { master: payload.isMaster }).equalTo('_id', id);

      const update = _.mapValues(deserialize(req.body) as any, v => ({ $set: v }));
      await response(res, () => query.updateOne(update as any));
    }
  );

  router.delete(
    '/classes/:name/:id',
    express.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { name, id } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);
      const query = payload.Query(name, { master: payload.isMaster }).equalTo('_id', id);

      await response(res, () => query.deleteOne());
    }
  );

  return router;
}