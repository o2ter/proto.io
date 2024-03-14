//
//  index.ts
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
import express, { RequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ProtoService } from './server/proto';
import { ProtoServiceKeyOptions, ProtoServiceOptions } from './server/proto/types';
import csrfHandler from './server/csrf';
import authHandler from './server/auth';
import classesRoute from './server/routes/classes';
import functionRoute from './server/routes/function';
import filesRoute from './server/routes/files';
import userRoute from './server/routes/user';
import schemaRoute from './server/routes/schema';
import configRoute from './server/routes/config';
import { PVK } from './internals';
import { TSchema } from './internals/schema';

export * from './common';
export { ProtoService } from './server/proto';
export { ProtoClient } from './client';

export const schema = _.assign((x: Record<string, TSchema>) => x, {
  shape: (shape: Record<string, TSchema.DataType>) => ({ type: 'shape', shape }) as const,
});

type AdapterHandler<E, Handler extends RequestHandler = RequestHandler>
  = Handler extends (req: infer Req, ...args: infer Rest) => void
  ? (req: ProtoService<E> & { req: Req; }, ...args: Rest) => void
  : never;

export const ProtoRoute = async <E>(options: {
  adapters?: AdapterHandler<E>[],
  proto: ProtoService<E> | (ProtoServiceOptions<E> & ProtoServiceKeyOptions);
}) => {

  const {
    adapters,
    proto: _proto,
  } = options;

  const proto = _proto instanceof ProtoService ? _proto : new ProtoService(_proto);
  await proto[PVK].prepare();

  const corsOpts = {
    credentials: true,
    origin: true,
  };

  const router = express.Router().use(
    cors(corsOpts),
    cookieParser() as any,
    csrfHandler(proto[PVK].options.csrfToken),
    authHandler(proto),
    ..._.map(adapters, x => ((req, res, next) => x(proto.connect(req), res, next)) as RequestHandler),
    (req, res, next) => {
      const payload = proto.connect(req);
      if (!payload.isInvalidMasterToken) return next();
      res.status(400).json({ message: 'Invalid token' });
    },
  );

  classesRoute(router, proto);
  functionRoute(router, proto);
  filesRoute(router, proto);
  userRoute(router, proto);
  schemaRoute(router, proto);
  configRoute(router, proto);

  return router;
}

export default ProtoRoute;