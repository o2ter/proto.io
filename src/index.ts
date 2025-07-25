//
//  index.ts
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
import { Router } from 'express';
import { Server } from '@o2ter/server-js';
import { ProtoService } from './server/proto';
import { ProtoServiceKeyOptions, ProtoServiceOptions } from './server/proto/types';
import authHandler from './server/auth';
import classesRoute from './server/routes/classes';
import functionRoute from './server/routes/function';
import jobRoute from './server/routes/job';
import filesRoute from './server/routes/files';
import userRoute from './server/routes/user';
import notifyRoute from './server/routes/notify';
import schemaRoute from './server/routes/schema';
import configRoute from './server/routes/config';
import { TSchema } from './internals/schema';
import { PVK } from './internals/private';
import { TValueWithoutObject } from './internals/types';
import Decimal from 'decimal.js';
import { response } from './server/routes/common';
import { QuerySelector } from './server/query/dispatcher/parser';
import { serialize } from './internals/codec';

export * from './internals/codec';
export { classExtends } from './internals/utils';
export { TFileStorage } from './server/file';
export { ProtoService } from './server/proto';
export { ProtoClient } from './client';

/**
 * Schema definition utility functions.
 */
export const schema = _.assign((x: Record<string, TSchema>) => x, {
  /**
   * Defines a boolean schema.
   * @param defaultValue - The default value for the boolean.
   * @returns The boolean schema.
   */
  boolean: (defaultValue?: boolean) => ({ type: 'boolean', default: defaultValue }) as const,

  /**
   * Defines a number schema.
   * @param defaultValue - The default value for the number.
   * @returns The number schema.
   */
  number: (defaultValue?: number) => ({ type: 'number', default: defaultValue }) as const,

  /**
   * Defines a decimal schema.
   * @param defaultValue - The default value for the decimal.
   * @returns The decimal schema.
   */
  decimal: (defaultValue?: Decimal) => ({ type: 'decimal', default: defaultValue }) as const,

  /**
   * Defines a string schema.
   * @param defaultValue - The default value for the string.
   * @returns The string schema.
   */
  string: (defaultValue?: string) => ({ type: 'string', default: defaultValue }) as const,

  /**
   * Defines a string array schema.
   * @param defaultValue - The default value for the string array.
   * @returns The string array schema.
   */
  stringArray: (defaultValue?: string[]) => ({ type: 'string[]', default: defaultValue }) as const,

  /**
   * Defines a date schema.
   * @param defaultValue - The default value for the date.
   * @returns The date schema.
   */
  date: (defaultValue?: Date) => ({ type: 'date', default: defaultValue }) as const,

  /**
   * Defines an object schema.
   * @param defaultValue - The default value for the object.
   * @returns The object schema.
   */
  object: <T extends Record<string, TValueWithoutObject>>(defaultValue?: T) => ({ type: 'object', default: defaultValue }) as const,

  /**
   * Defines an array schema.
   * @param defaultValue - The default value for the array.
   * @returns The array schema.
   */
  array: <T extends TValueWithoutObject[]>(defaultValue?: T) => ({ type: 'array', default: defaultValue }) as const,

  /**
   * Defines a vector schema.
   * @param dimension - The dimension of the vector.
   * @param defaultValue - The default value for the vector.
   * @returns The vector schema.
   */
  vector: (dimension: number, defaultValue?: number[]) => ({ type: 'vector', dimension, default: defaultValue }) as const,

  /**
   * Defines a shape schema.
   * @param shape - The shape definition.
   * @returns The shape schema.
   */
  shape: (shape: Record<string, TSchema.DataType>) => ({ type: 'shape', shape }) as const,

  /**
   * Defines a pointer schema.
   * @param target - The target of the pointer.
   * @returns The pointer schema.
   */
  pointer: (target: string) => ({ type: 'pointer', target }) as const,

  /**
   * Defines a relation schema.
   * @param target - The target of the relation.
   * @param foreignField - The foreign field of the relation.
   * @returns The relation schema.
   */
  relation: (target: string, foreignField?: string) => ({ type: 'relation', target, foreignField }) as const,
});

/**
 * Creates a ProtoRoute.
 * @param options - The options for the ProtoRoute.
 * @returns A promise that resolves to a Router.
 */
export const ProtoRoute = async <E>(options: {
  proto: ProtoService<E> | (ProtoServiceOptions<E> & ProtoServiceKeyOptions);
}): Promise<Router> => {

  const proto = options.proto instanceof ProtoService ? options.proto : new ProtoService(options.proto);
  await proto[PVK].prepare();

  const router = Server.Router().use(
    authHandler(proto),
    (req, res, next) => {
      const payload = proto.connect(req);
      if (!payload.isInvalidMasterToken) return next();
      res.status(400).json({ message: 'Invalid token' });
    },
  );

  router.get('/health', (req, res) => { res.sendStatus(200); });
  router.get('/sessionInfo', async (req, res) => {
    await response(res, () => proto.connect(req).sessionInfo());
  });

  classesRoute(router, proto);
  functionRoute(router, proto);
  jobRoute(router, proto);
  filesRoute(router, proto);
  userRoute(router, proto);
  notifyRoute(router, proto);
  schemaRoute(router, proto);
  configRoute(router, proto);

  return router;
}

/**
 * Registers a ProtoSocket.
 * @param proto - The ProtoService instance.
 * @param server - The server instance.
 * @param endpoint - The optional endpoint.
 * @returns The socket.io instance.
 */
export const registerProtoSocket = <E>(
  proto: ProtoService<E>,
  server: Server,
  endpoint?: string,
) => {
  const io = endpoint ? server.socket().of(endpoint) : server.socket();

  io.on('connection', async (socket) => {

    let { token } = socket.handshake.auth;
    const service = await proto.connectWithSessionToken(token);

    socket.on('auth', (t) => {
      token = t;
      service.connectWithSessionToken(t);
    });

    type QueryOpts = {
      event: string;
      className: string;
      filter: QuerySelector | boolean;
    };

    let events: Record<string, QuerySelector | boolean> = {};
    let queries: Record<string, QueryOpts> = {};

    const { remove: remove_basic } = service.listen(data => {
      const ids = _.keys(_.pickBy(events, v => v instanceof QuerySelector ? v.eval(data) : v));
      const payload = JSON.parse(serialize(data));
      if (!_.isEmpty(ids)) socket.emit('ON_EV_NOTIFY', { ids, data: payload });
    });

    const { remove: remove_livequery } = service[PVK]._liveQuery(service, (ev, objs) => {
      const ids: Record<string, string[]> = {};
      for (const obj of objs) {
        ids[obj.id!] = _.keys(_.pickBy(queries, v => {
          if (v.event !== ev || v.className !== obj.className) return false;
          return v.filter instanceof QuerySelector ? v.filter.eval(obj) : v.filter;
        }));
      }
      if (_.isEmpty(ids)) return;
      const payload = JSON.parse(serialize(_.filter(objs, obj => !_.isEmpty(ids[obj.id!]))));
      socket.emit('ON_EV_LIVEQUERY', { ids, data: payload });
    });

    socket.on('disconnect', () => {
      remove_basic();
      remove_livequery();
    });

    socket.on('EV_NOTIFY', (payload) => {
      events = _.mapValues(payload, v => {
        if (_.isBoolean(v)) return true;
        try {
          return QuerySelector.decode(v);
        } catch (error) {
          proto.logger.error(error);
          return false;
        }
      });
    });

    socket.on('EV_LIVEQUERY', (payload) => {
      queries = _.mapValues(payload, v => {
        const { event = '', className = '', filter } = v ?? {};
        if (_.isBoolean(v)) return { event, className, filter: true };
        try {
          return { event, className, filter: QuerySelector.decode(filter) };
        } catch (error) {
          proto.logger.error(error);
          return { event, className, filter: false };
        }
      });
    });
  });

  return io;
}

export default ProtoRoute;