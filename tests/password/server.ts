//
//  server.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/postgres';
import { randomUUID } from '@o2ter/crypto-js';

const app = new Server({
  http: 'v1',
  express: {
    rateLimit: {
      windowMs: 1000,
      limit: 1000,
    },
  },
});

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

// Custom password validator for testing
const passwordValidator = (password: string) => {
  // Minimum 8 characters
  if (password.length < 8) return false;
  // Must contain at least one uppercase letter
  if (!/[A-Z]/.test(password)) return false;
  // Must contain at least one lowercase letter
  if (!/[a-z]/.test(password)) return false;
  // Must contain at least one digit
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const Proto = new ProtoService({
  endpoint: 'http://localhost:8081/proto',
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
  passwordPolicy: {
    maxPasswordHistory: 3,
    validatorCallback: passwordValidator,
  },
});

Proto.define('createTestUser', async (proto) => {
  const user = await proto.Query('User').insert({ name: 'test' });
  return user;
});

Proto.define('setPassword', async (proto) => {
  const { userId, password } = proto.params;
  const user = await proto.Query('User').get(userId, { master: true });
  if (!user) throw new Error('User not found');
  await proto.setPassword(user, password, { master: true });
  return { success: true };
});

Proto.define('verifyPassword', async (proto) => {
  const { userId, password } = proto.params;
  const user = await proto.Query('User').get(userId, { master: true });
  if (!user) throw new Error('User not found');
  return await proto.verifyPassword(user, password, { master: true });
});

Proto.define('unsetPassword', async (proto) => {
  const { userId } = proto.params;
  const user = await proto.Query('User').get(userId, { master: true });
  if (!user) throw new Error('User not found');
  await proto.unsetPassword(user, { master: true });
  return { success: true };
});

beforeAll(async () => {

  app.use('/proto', await ProtoRoute({
    proto: Proto,
  }));

  console.info('version: ', await database.version());

  app.listen(8081, () => console.info('listening on port 8081'));
});

beforeEach(async () => {
  for (const className of Proto.classes()) {
    await Proto.Query(className).deleteMany({ master: true, silent: true });
  }
});

afterAll(async () => { 
  await Proto.shutdown();
  await database.shutdown();
  await app.close();
});
