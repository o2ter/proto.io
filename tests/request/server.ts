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
import { ProtoService, ProtoRoute, UUID } from '../../src/index';
import { beforeAll, afterAll } from '@jest/globals';
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/progres';

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

export const masterUser = {
  user: 'admin',
  pass: (new UUID).toHexString(),
};

const Proto = new ProtoService({
  endpoint: 'http://localhost:8080/proto',
  masterUsers: [masterUser],
  jwtToken: (new UUID).toHexString(),
  schema: {
    'User': {
      fields: {
        name: 'string',
      }
    },
    'Test': {
      fields: {
        default: { type: 'number', default: 42 },
        boolean: 'boolean',
        number: 'number',
        decimal: 'decimal',
        string: 'string',
        date: 'date',
        object: 'object',
        array: 'array',
        null_boolean: 'boolean',
        null_number: 'number',
        null_decimal: 'decimal',
        null_string: 'string',
        null_date: 'date',
        null_object: 'object',
        null_array: 'array',
        no_permission: 'boolean',
        pointer: { type: 'pointer', target: 'Test' },
        pointer2: { type: 'pointer', target: 'Test' },
        relation: { type: 'relation', target: 'Test' },
        relation2: { type: 'relation', target: 'Test', foreignField: 'pointer' },
        relation3: { type: 'relation', target: 'Test', foreignField: 'relation' },
      },
      fieldLevelPermissions: {
        no_permission: { read: [], create: [], update: [] }
      }
    }
  },
  storage: database,
  fileStorage: new DatabaseFileStorage(),
});

Proto.define('echo', (proto) => {
  return proto.data;
});

Proto.define('sessionId', (proto) => {
  return proto.sessionId;
});

Proto.define('createUser', async (proto) => {
  const user = await proto.Query('User').insert({ name: 'test' });
  await proto.setPassword(user, 'password123');
  if (!await proto.varifyPassword(user, 'password123')) throw Error('incorrect password');
  proto.becomeUser(proto.req!, user);
});

beforeAll(async () => {

  const app = express();

  app.use('/proto', await ProtoRoute({
    proto: Proto,
  }));

  console.log('version: ', await database.version());

  httpServer = require('http-shutdown')(require('http').createServer(app));
  httpServer.listen(8080, () => console.log('listening on port 8080'));
});

afterAll(() => new Promise<void>(async (res) => {
  await database.shutdown();
  httpServer.shutdown(res);
}));
