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
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/progres';
import { QuerySelector } from '../../src/server/query/validator/parser';

let httpServer: any;

const db_host = process.env['POSTGRES_HOST'] ?? "localhost";
const db_user = process.env['POSTGRES_USERNAME'];
const db_pass = process.env['POSTGRES_PASSWORD'];
const db = `/${process.env['POSTGRES_DATABASE'] ?? ''}`;
const db_ssl = process.env['POSTGRES_SSLMODE'];

const uri = _.compact([
  'postgres://',
  db_user && db_pass && `${db_user}:${db_pass}@`,
  db_host, db,
  db_ssl && `?ssl=true&sslmode=${db_ssl}`
]).join('');

const database = new PostgresStorage(uri);

const proto = new Proto({
  endpoint: 'http://localhost:8080',
  schema: {},
  storage: database,
  fileStorage: new DatabaseFileStorage(),
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

  console.log('version: ', await database.version());

  console.log(database._queryCompiler({
    filter: new QuerySelector,
    includes: [
      '_id',
      'users._id',
      'roles._id',
      'roles.roles._id',
      'roles.roles.roles._id',
      'roles.roles.roles.roles._id',
    ],
    className: '_Role',
    acls: [],
    master: false,
  }))

  httpServer = require('http-shutdown')(require('http').createServer(app));
  httpServer.listen(8080, () => console.log('listening on port 8080'));
});

afterAll(() => new Promise<void>(async (res) => {
  await database.shutdown();
  httpServer.shutdown(res);
}));
