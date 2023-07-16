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
import express from 'express';
import cookieParser from 'cookie-parser';
import { Proto, ProtoOptions } from './utils/types';
import csrfHandler from './utils/csrf';
import functionRoute from './utils/routes/function';

export * from './utils/codec';
export * from './utils/types';

export const ProtoRoute = async (options: {
  csrfToken?: string;
  proto: Proto | ProtoOptions;
}) => {

  const { csrfToken: token, proto: protoOtps } = options;

  const router = express.Router()
    .use(cookieParser() as any)
    .use(csrfHandler(token));

  const proto = protoOtps instanceof Proto ? protoOtps : new Proto(protoOtps);
  await proto._prepare();
  functionRoute(router, proto);

  return router;
}

export default ProtoRoute;