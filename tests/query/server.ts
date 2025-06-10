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
import { Server } from '@o2ter/server-js';
import { ProtoService, ProtoRoute, schema, Decimal } from '../../src/index';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import DatabaseFileStorage from '../../src/adapters/file/database';
import PostgresStorage from '../../src/adapters/storage/progres';
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

const Proto = new ProtoService({
  endpoint: 'http://localhost:8080/proto',
  masterUsers: [masterUser],
  jwtToken: randomUUID(),
  roleResolver: {
    inheritKeys: ['groupUsers'],
  },
  schema: {
    'User': {
      fields: {
        groups: { type: 'relation', target: 'Group', foreignField: 'users' },
      },
    },
    'Role': {
      fields: {
        groupUsers: { type: 'relation', target: 'User', foreignField: 'groups.roles' },
      },
    },
    'Group': {
      fields: {
        users: { type: 'relation', target: 'User' },
        roles: { type: 'relation', target: 'Role' },
      },
    },
    'Test': {
      fields: {
        unique: 'number',
        default: { type: 'number', default: 42 },
        defaultDecimal: { type: 'decimal', default: new Decimal(0) },
        boolean: 'boolean',
        number: 'number',
        x: 'number',
        y: 'number',
        decimal: 'decimal',
        string: 'string',
        stringArr: 'string[]',
        vector: schema.vector(3),
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
        relation4: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer' },
        relation5: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer.relation' },
        relation6: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer.relation.relation' },
        relation7: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer.relation.relation.relation.relation' },
        relation8: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer.relation2.relation' },
        relation9: { type: 'relation', target: 'Test', foreignField: 'pointer.pointer.relation2.relation.pointer.pointer' },
        relation2b: { type: 'relation', target: 'Test', foreignField: 'pointer', match: { filter: { number: { $gt: 1 } }, sort: { _created_at: 1 }, limit: 1 } },
        '_test_field-name_01': 'string',
        shape: schema.shape({
          default: { type: 'number', default: 42 },
          boolean: 'boolean',
          number: 'number',
          decimal: 'decimal',
          string: 'string',
          stringArr: 'string[]',
          vector: schema.vector(3),
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
          '_test_field-name_01': 'string',
        }),
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
      fieldLevelPermissions: {
        no_permission: { read: ['role:admin'], create: ['role:admin'], update: ['role:admin'] }
      },
      indexes: [
        { keys: { unique: 1 }, unique: true },
        { keys: { default: 1 } },
        { keys: { boolean: 1 } },
        { keys: { number: 1 } },
        { keys: { decimal: 1 } },
        { keys: { string: 1 } },
        { keys: { stringArr: 1 } },
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
        { keys: { '_test_field-name_01': 1 } },
        { keys: { 'shape.default': 1 } },
        { keys: { 'shape.boolean': 1 } },
        { keys: { 'shape.number': 1 } },
        { keys: { 'shape.decimal': 1 } },
        { keys: { 'shape.string': 1 } },
        { keys: { 'shape.stringArr': 1 } },
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
        { keys: { 'shape._test_field-name_01': 1 } },
      ],
    },
    'Relation': {
      fields: {
        number: 'number',
        relation: { type: 'relation', target: 'Relation3', foreignField: 'pointer.pointer' },
        relation7: { type: 'relation', target: 'Relation7', foreignField: 'pointer.pointer.relation.relation.relation.relation' },
        relation9: { type: 'relation', target: 'Relation7', foreignField: 'pointer.pointer.relation2.relation.pointer.pointer' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation2': {
      fields: {
        pointer: { type: 'pointer', target: 'Relation' },
        relation: { type: 'relation', target: 'Relation' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation3': {
      fields: {
        pointer: { type: 'pointer', target: 'Relation2' },
        relation: { type: 'relation', target: 'Relation2' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation4': {
      fields: {
        pointer: { type: 'pointer', target: 'Relation5' },
        relation: { type: 'relation', target: 'Relation3' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation5': {
      fields: {
        relation: { type: 'relation', target: 'Relation4' },
        relation2: { type: 'relation', target: 'Relation4', foreignField: 'pointer' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation6': {
      fields: {
        pointer: { type: 'pointer', target: 'Relation5' },
        relation: { type: 'relation', target: 'Relation5' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
    'Relation7': {
      fields: {
        pointer: { type: 'pointer', target: 'Relation6' },
        relation: { type: 'relation', target: 'Relation6' },
      },
      additionalObjectPermissions: {
        read: ['role:system'],
        update: ['role:system'],
      },
    },
  },
  storage: database,
  fileStorage: new DatabaseFileStorage(),
});

Proto.define('currentRoles', async ({ currentRoles }) => currentRoles());

Proto.define('createUserWithRole', async (proto) => {
  const { role } = proto.params;
  const _role = await proto.Query('Role').equalTo('name', role).first({ master: true }) ?? await proto.Query('Role').insert({ name: role }, { master: true });
  const user = await proto.Query('User').insert({});
  _role.addToSet('users', [user]);
  await _role.save({ master: true });
  await proto.becomeUser(proto.req!, user);
});

Proto.define('updateWithTransaction', async (proto) => {
  const { className, values, error } = proto.params;
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
  const { className, values, values2, error } = proto.params;

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
  const { id } = proto.params;

  return await proto.withTransaction(async (proto) => {

    let object = await proto.Query('Test').equalTo('_id', id).first();

    await new Promise<void>(res => setTimeout(res, 100));

    object = await proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    await new Promise<void>(res => setTimeout(res, 100));

    object = await proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } });

    return object?.get('number');

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithLongTransaction2', async (proto) => {

  return await proto.withTransaction(async (proto) => {

    await proto.lockTable('Test', true);

    const count = await proto.Query('Test').equalTo('string', 'updateWithLongTransaction2').count();

    await new Promise<void>(res => setTimeout(res, 100));

    await proto.Query('Test').insert({
      number: 0,
      string: 'updateWithLongTransaction2',
    });

    return count;

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithLongTransaction3', async (proto) => {

  return await proto.withTransaction(async (proto) => {

    await proto.lockTable('Test', true);

    await proto.Query('Test').insert({
      number: 0,
      string: 'updateWithLongTransaction3',
    });

    await new Promise<void>(res => setTimeout(res, 100));

    return proto.Query('Test').equalTo('string', 'updateWithLongTransaction3').count();

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithTransactionSession', async (proto) => {
  const { className, values, error } = proto.params;
  try {

    await proto.withTransaction(async (proto) => {
      await Proto.Query(className)
        .equalTo('_id', values._id)
        .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })), { session: proto });
      if (_.isString(error)) throw Error(error);
    });

    return { success: true, error: null };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

Proto.define('updateWithNestedTransactionSession', async (proto) => {
  const { className, values, values2, error } = proto.params;

  await proto.withTransaction(async (proto) => {

    await Proto.Query(className)
      .equalTo('_id', values._id)
      .updateOne(_.mapValues(_.omit(values, '_id'), v => ({ $set: v })), { session: proto });

    try {

      await proto.withTransaction(async (proto) => {
        await Proto.Query(className)
          .equalTo('_id', values2._id)
          .updateOne(_.mapValues(_.omit(values2, '_id'), v => ({ $set: v })), { session: proto });
        if (_.isString(error)) throw Error(error);
      });
    } catch { }
  });
});

Proto.define('updateWithLongTransactionSession', async (proto) => {
  const { id } = proto.params;

  return await proto.withTransaction(async (proto) => {

    let object = await Proto.Query('Test').equalTo('_id', id).first({ session: proto });

    await new Promise<void>(res => setTimeout(res, 100));

    object = await Proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } }, { session: proto });

    await new Promise<void>(res => setTimeout(res, 100));

    object = await Proto.Query('Test').equalTo('_id', id).updateOne({ number: { $set: object?.get('number') + 1 } }, { session: proto });

    return object?.get('number');

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithLongTransactionSession2', async (proto) => {

  return await proto.withTransaction(async (proto) => {

    await proto.lockTable('Test', true);

    const count = await Proto.Query('Test').equalTo('string', 'updateWithLongTransactionSession2').count({ session: proto });

    await new Promise<void>(res => setTimeout(res, 100));

    await Proto.Query('Test').insert({
      number: 0,
      string: 'updateWithLongTransactionSession2',
    }, { session: proto });

    return count;

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithLongTransactionSession3', async (proto) => {

  return await proto.withTransaction(async (proto) => {

    await proto.lockTable('Test', true);

    await Proto.Query('Test').insert({
      number: 0,
      string: 'updateWithLongTransactionSession3',
    }, { session: proto });

    await new Promise<void>(res => setTimeout(res, 100));

    return Proto.Query('Test').equalTo('string', 'updateWithLongTransactionSession3').count({ session: proto });

  }, { mode: 'repeatable', retry: true });
});

Proto.define('updateWithAtomic', async (proto) => {

  const { inserted } = proto.params;

  while (true) {
    const doc = await inserted.clone().fetchWithInclude(['number']);

    await new Promise<void>(res => setTimeout(res, 100));

    const updated = await proto.Query('Test')
      .equalTo('__v', doc.__v)
      .equalTo('_id', doc.id)
      .updateOne({
        number: { $inc: 1 },
      });

    if (updated) return updated.get('number');
  }
});

Proto.define('updateWithAtomic2', async (proto) => {

  const { inserted } = proto.params;

  while (true) {
    const doc = await inserted.clone().fetchWithInclude(['number']);

    await new Promise<void>(res => setTimeout(res, 100));

    const updated = await proto.Query('Test')
      .equalTo('__v', doc.__v)
      .equalTo('_id', doc.id)
      .updateOne({
        number: { $set: doc.get('number') + 1 },
      });

    if (updated) return updated.get('number');
  }
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
});
