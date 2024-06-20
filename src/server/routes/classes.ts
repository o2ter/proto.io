//
//  classes.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import queryType from 'query-types';
import { response } from './common';
import { deserialize } from '../../common';
import { PVK } from '../../internals/private';

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/classes/:name',
    Server.text({ type: '*/*' }),
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
          setOnInsert,
          ...options
        } = deserialize(req.body) as any;

        const payload = proto.connect(req);
        const query = payload.Query(name);
        query[PVK].options = options;

        const opts = { master: payload.isMaster, context };

        switch (operation) {
          case 'explain':
            if (!payload.isMaster) throw Error('No permission');
            return query.explain(opts);
          case 'count': return query.count(opts);
          case 'find':
            {
              const maxFetchLimit = payload[PVK].options.maxFetchLimit;
              query[PVK].options.limit = query[PVK].options.limit ?? maxFetchLimit;
              if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
              return await query.find(opts);
            }
          case 'random':
            {
              const maxFetchLimit = payload[PVK].options.maxFetchLimit;
              query[PVK].options.limit = query[PVK].options.limit ?? maxFetchLimit;
              if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
              return await query.random(random, opts);
            }
          case 'nonrefs':
            {
              const maxFetchLimit = payload[PVK].options.maxFetchLimit;
              query[PVK].options.limit = query[PVK].options.limit ?? maxFetchLimit;
              if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
              return await query.nonrefs(opts);
            }
          case 'insert': return query.insert(attributes, opts);
          case 'updateOne': return query.updateOne(update, opts);
          case 'upsertOne': return query.upsertOne(update, setOnInsert, opts);
          case 'deleteOne': return query.deleteOne(opts);
          case 'deleteMany': return query.deleteMany(opts);
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
      const query = payload.Query(name);

      const opts = { master: payload.isMaster };

      await response(res, async () => {

        const {
          filter,
          sort,
          includes,
          skip,
          limit,
        } = req.query;

        const maxFetchLimit = payload[PVK].options.maxFetchLimit;

        query[PVK].options.filter = !_.isEmpty(filter) && _.isString(filter) ? _.castArray(deserialize(filter)) as any : [];
        query[PVK].options.sort = _.isPlainObject(sort) && _.every(_.values(sort), _.isNumber) ? sort as any : undefined;
        query[PVK].options.includes = _.isArray(includes) && _.every(includes, _.isString) ? includes as any : undefined;
        query[PVK].options.skip = _.isNumber(skip) ? skip : undefined;
        query[PVK].options.limit = _.isNumber(limit) ? limit : maxFetchLimit;

        if (query[PVK].options.limit > maxFetchLimit) throw Error('Query over limit');
        return await query.find(opts);
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

      await response(res, () => payload.Query(name).get(id, { master: payload.isMaster }));
    }
  );

  router.patch(
    '/classes/:name/:id',
    Server.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name, id } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);
      const query = payload.Query(name).equalTo('_id', id);

      const update = _.mapValues(deserialize(req.body) as any, v => ({ $set: v }));
      await response(res, () => query.updateOne(update as any, { master: payload.isMaster }));
    }
  );

  router.delete(
    '/classes/:name/:id',
    Server.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      if (!_.isEmpty(req.body)) return res.sendStatus(400);

      const { name, id } = req.params;
      const classes = proto.classes();

      if (!_.includes(classes, name)) return res.sendStatus(404);

      const payload = proto.connect(req);
      const query = payload.Query(name).equalTo('_id', id);

      await response(res, () => query.deleteOne({ master: payload.isMaster }));
    }
  );

  return router;
}