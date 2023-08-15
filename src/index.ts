//
//  index.ts
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
import express, { RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { ProtoService } from './server/proto';
import { ProtoServiceOptions } from './server/proto/types';
import csrfHandler from './server/csrf';
import authHandler from './server/auth';
import classesRoute from './server/routes/classes';
import functionRoute from './server/routes/function';
import filesRoute from './server/routes/files';
import userRoute from './server/routes/user';
import schemaRoute from './server/routes/schema';
import { PVK } from './internals';
import { TSchema } from './internals/schema';

export * from './common';
export { ProtoService } from './server/proto';
export { ProtoClient } from './client';

export const schema = (x: Record<string, TSchema>) => x;

export const ProtoRoute = async <E>(options: {
  adapters?: ((proto: ProtoService<E>) => RequestHandler)[],
  proto: ProtoService<E> | ProtoServiceOptions<E>;
}) => {

  const {
    adapters,
    proto: _proto,
  } = options;

  const proto = _proto instanceof ProtoService ? _proto : new ProtoService(_proto);
  await proto[PVK].prepare();

  const router = express.Router().use(
    cookieParser() as any,
    csrfHandler(proto[PVK].options.csrfToken),
    authHandler(proto),
    ..._.map(adapters, x => x(proto)),
  );

  classesRoute(router, proto);
  functionRoute(router, proto);
  filesRoute(router, proto);
  userRoute(router, proto);
  schemaRoute(router, proto);

  return router;
}

export default ProtoRoute;