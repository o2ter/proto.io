//
//  server.ts
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
import { Proto, ProtoRoute, UUID } from '../../src/index';
import { beforeAll, afterAll } from '@jest/globals';
import { MemoryStorage } from '../../src/storage/memory';

let httpServer: any;

const proto = new Proto({
  schema: {},
  storage: new MemoryStorage(),
  fileStorage: null as any,
});

proto.define('echo', (req) => {
  return req.data;
});

beforeAll(async () => {

  const app = express();

  app.use(await ProtoRoute({
    jwtToken: (new UUID()).toString(),
    proto: proto,
  }));
  
  httpServer = require('http-shutdown')(require('http').createServer(app));
  httpServer.listen(8080, () => console.log('listening on port 8080'));
});

afterAll(() => new Promise<void>(async (res) => {
  await proto.shutdown();
  httpServer.shutdown(res);
}));
