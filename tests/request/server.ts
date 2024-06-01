//
//  server.ts
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
import { Server } from '@o2ter/server-js';
import { ProtoService, ProtoRoute } from '../../src/index';
import { beforeAll, afterAll } from '@jest/globals';
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/progres';
import { randomUUID } from '@o2ter/crypto-js';

const app = new Server;

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
  pass: randomUUID(),
};

const Proto = new ProtoService({
  endpoint: 'http://localhost:8080/proto',
  masterUsers: [masterUser],
  jwtToken: randomUUID(),
  schema: {
    'User': {
      fields: {
        name: 'string',
      }
    },
  },
  storage: database,
  fileStorage: new DatabaseFileStorage(),
});

Proto.define('checkHealth', (proto) => {
  return proto.online();
});

Proto.define('echo', ({ params }) => {
  return params;
});

Proto.define('echoMaster', ({ params }) => {
  return params;
}, {
  validator: {
    requireMaster: true,
  },
});

Proto.define('echoUser', ({ params }) => {
  return params;
}, {
  validator: {
    requireUser: true,
  },
});

Proto.define('sessionId', ({ sessionId }) => {
  return sessionId;
});

Proto.define('createUser', async (proto) => {
  const user = await proto.Query('User').insert({ name: 'test' });
  await proto.setPassword(user, 'password123', { master: true });
  if (!await proto.varifyPassword(user, 'password123', { master: true })) throw Error('incorrect password');
  await proto.becomeUser(proto.req!, user);
});

Proto.define('createUserWithRole', async (proto) => {
  const { role } = proto.params as any;
  const _role = await proto.Query('Role').equalTo('name', role).first({ master: true }) ?? await proto.Query('Role').insert({ name: role }, { master: true });
  const user = await proto.Query('User').insert({ name: 'test' });
  _role.addToSet('users', [user]);
  await _role.save({ master: true });
  await proto.becomeUser(proto.req!, user);
});

beforeAll(async () => {

  app.use('/proto', await ProtoRoute({
    proto: Proto,
  }));

  console.log('version: ', await database.version());

  app.listen(8080, () => console.log('listening on port 8080'));
});

afterAll(async () => { 
  await Proto.shutdown();
  await database.shutdown();
  await app.close();
});
