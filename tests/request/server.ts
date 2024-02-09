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
import express from 'express';
import { ProtoService, ProtoRoute } from '../../src/index';
import { beforeAll, afterAll } from '@jest/globals';
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/progres';
import { randomUUID } from '@o2ter/crypto-js';

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
        'test_field-name': 'string',
        shape: {
          type: 'shape',
          shape: {
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
            pointer: { type: 'pointer', target: 'Test' },
            pointer2: { type: 'pointer', target: 'Test' },
            relation: { type: 'relation', target: 'Test' },
            relation2: { type: 'relation', target: 'Test', foreignField: 'pointer' },
            relation3: { type: 'relation', target: 'Test', foreignField: 'relation' },
            'test_field-name': 'string',
          },
        },
      },
      fieldLevelPermissions: {
        no_permission: { read: ['role:admin'], create: ['role:admin'], update: ['role:admin'] }
      },
      indexes: [
        { keys: { default: 1 } },
        { keys: { boolean: 1 } },
        { keys: { number: 1 } },
        { keys: { decimal: 1 } },
        { keys: { string: 1 } },
        { keys: { date: 1 } },
        { keys: { object: 1 } },
        { keys: { array: 1 } },
        { keys: { null_boolean: 1 } },
        { keys: { null_number: 1 } },
        { keys: { null_decimal: 1 } },
        { keys: { null_string: 1 } },
        { keys: { null_date: 1 } },
        { keys: { null_object: 1 } },
        { keys: { null_array: 1 } },
        { keys: { no_permission: 1 } },
        { keys: { pointer: 1 } },
        { keys: { pointer2: 1 } },
        { keys: { relation: 1 } },
        { keys: { 'test_field-name': 1 } },
        { keys: { 'shape.default': 1 } },
        { keys: { 'shape.boolean': 1 } },
        { keys: { 'shape.number': 1 } },
        { keys: { 'shape.decimal': 1 } },
        { keys: { 'shape.string': 1 } },
        { keys: { 'shape.date': 1 } },
        { keys: { 'shape.object': 1 } },
        { keys: { 'shape.array': 1 } },
        { keys: { 'shape.null_boolean': 1 } },
        { keys: { 'shape.null_number': 1 } },
        { keys: { 'shape.null_decimal': 1 } },
        { keys: { 'shape.null_string': 1 } },
        { keys: { 'shape.null_date': 1 } },
        { keys: { 'shape.null_object': 1 } },
        { keys: { 'shape.null_array': 1 } },
        { keys: { 'shape.pointer': 1 } },
        { keys: { 'shape.pointer2': 1 } },
        { keys: { 'shape.relation': 1 } },
        { keys: { 'shape.test_field-name': 1 } },
      ],
    }
  },
  storage: database,
  fileStorage: new DatabaseFileStorage(),
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
  const _role = await proto.Query('Role', { master: true }).equalTo('name', role).first() ?? await proto.Query('Role', { master: true }).insert({ name: role });
  const user = await proto.Query('User').insert({ name: 'test' });
  _role.addToSet('users', [user]);
  await _role.save({ master: true });
  await proto.becomeUser(proto.req!, user);
});

Proto.define('updateWithTransaction', async (proto) => {
  const { className, values, error } = proto.params as any;
  try {

    await proto.withTransaction(async (proto) => {
      await proto.Query(className)
        .equalTo('_id', values._id)
        .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })));
      if (_.isString(error)) throw Error(error);
    });

    return { success: true, error: null };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

Proto.define('updateWithNestedTransaction', async (proto) => {
  const { className, values, values2, error } = proto.params as any;

  await proto.withTransaction(async (proto) => {

    await proto.Query(className)
      .equalTo('_id', values._id)
      .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })));

    try {

      await proto.withTransaction(async (proto) => {
        await proto.Query(className)
          .equalTo('_id', values2._id)
          .updateOne(_.mapValues(_.omit(values2, '_id'), v => ({ $set: v })));
        if (_.isString(error)) throw Error(error);
      });
    } catch { }
  });
});

Proto.define('updateWithLongTransaction', async (proto) => {
  const { id } = proto.params as any;

  return await proto.withTransaction(async (proto) => {

    let object = await proto.Query('Test').equalTo('_id', id).first();

    await new Promise<void>(res => setTimeout(res, 100));

    object = await proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    await new Promise<void>(res => setTimeout(res, 100));

    object = await proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    return object?.get('number');

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithTransactionSession', async (proto) => {
  const { className, values, error } = proto.params as any;
  try {

    await proto.withTransaction(async (proto) => {
      await Proto.Query(className, { session: proto })
        .equalTo('_id', values._id)
        .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })));
      if (_.isString(error)) throw Error(error);
    });

    return { success: true, error: null };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

Proto.define('updateWithNestedTransactionSession', async (proto) => {
  const { className, values, values2, error } = proto.params as any;

  await proto.withTransaction(async (proto) => {

    await Proto.Query(className, { session: proto })
      .equalTo('_id', values._id)
      .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })));

    try {

      await proto.withTransaction(async (proto) => {
        await Proto.Query(className, { session: proto })
          .equalTo('_id', values2._id)
          .updateOne(_.mapValues(_.omit(values2, '_id'), v => ({ $set: v })));
        if (_.isString(error)) throw Error(error);
      });
    } catch { }
  });
});

Proto.define('updateWithLongTransactionSession', async (proto) => {
  const { id } = proto.params as any;

  return await proto.withTransaction(async (proto) => {

    let object = await Proto.Query('Test', { session: proto }).equalTo('_id', id).first();

    await new Promise<void>(res => setTimeout(res, 100));

    object = await Proto.Query('Test', { session: proto }).equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    await new Promise<void>(res => setTimeout(res, 100));

    object = await Proto.Query('Test', { session: proto }).equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    return object?.get('number');

  }, { mode: 'repeatable', retry: true });
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
