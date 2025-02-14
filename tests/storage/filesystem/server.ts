//
//  server.ts
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
import path from 'path';
import fs from 'fs/promises';
import { Server } from '@o2ter/server-js';
import { ProtoService, ProtoRoute } from '../../../src/index';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import PostgresStorage from '../../../src/adapters/storage/progres';
import { randomUUID } from '@o2ter/crypto-js';
import FileSystemStorage from '../../../src/adapters/file/filesystem';

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

const directory = path.resolve(__dirname, '.temp');

const Proto = new ProtoService({
  endpoint: 'http://localhost:8080/proto',
  masterUsers: [masterUser],
  jwtToken: randomUUID(),
  schema: {},
  storage: database,
  fileStorage: new FileSystemStorage(directory),
});

Proto.define('generateUploadToken', async (proto) => {
  return proto.generateUploadToken({
    attributes: proto.params as any,
  });
});

Proto.define('createFileInternal', async (proto) => {
  const file = Proto.File('test.txt', 'hello, world', 'text/plain');
  return file.save();
});

beforeAll(async () => {

  app.use('/proto', await ProtoRoute({
    proto: Proto,
  }));

  console.info('version: ', await database.version());

  app.listen(8080, () => console.info('listening on port 8080'));
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

  await fs.rm(directory, { recursive: true, force: true });
});
