//
//  index.test.ts
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

import fs from 'fs';
import { Readable } from 'node:stream';
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

const streamToBuffer = async (stream: any) => {
  const _stream = stream instanceof Readable ? stream : Readable.fromWeb(stream);
  let buffer = Buffer.from([]);
  for await (const chunk of _stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

test('echo', async () => {
  const result = await Proto.run('echo', 'hello, world');
  expect(result).toStrictEqual('hello, world');
});
test('test codec', async () => {

  const obj = {
    hello: 'world',
    $array: [1, 2, null, { string: '' }],
    decimal: new Decimal('10.05'),
    date: new Date(),
  };

  const result = await Proto.run('echo', obj);
  expect(result).toStrictEqual(obj);
});
test('test schema', async () => {
  const result = await Proto.schema({ master: true });
  expect(result.User).toBeTruthy();
});
test('test session id', async () => {
  const sessionId = await Proto.run('sessionId');
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
});
test('test user', async () => {
  await Proto.run('createUser');
  const user = await Proto.currentUser();
  expect(user?.objectId).toBeTruthy();
  await Proto.logout();
  const user2 = await Proto.currentUser();
  expect(user2?.objectId).toBeUndefined();
});
test('test files', async () => {
  const file = Proto.File('test.txt', 'hello, world', 'text/plain');
  await file.save();

  const data = await streamToBuffer(file.fileData());
  expect(data.toString('utf8')).toStrictEqual('hello, world');
});
test('test files 2', async () => {
  const file = Proto.File('test.txt', fs.createReadStream(__filename), 'text/plain');
  await file.save();

  const data = await streamToBuffer(file.fileData());
  expect(data.toString('utf8')).toStrictEqual(fs.readFileSync(__filename, { encoding: 'utf8' }));
});

test('test count', async () => {
  await Proto.Query('Test').insert({});
  const count = await Proto.Query('Test').count();
  expect(count).toBeGreaterThan(0);
})

test('test insert', async () => {
  const inserted = await Proto.Query('Test').insert({ string: 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('hello');
})

test('test types', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  expect(inserted.get('boolean')).toStrictEqual(true);
  expect(inserted.get('number')).toStrictEqual(42);
  expect(inserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('default', 42).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('null_boolean', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_number', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_decimal', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_string', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_date', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('null_boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_number', 42).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('number', [1, 2, 3, 42]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.0', [1, 2, 3, 42, 'hello']).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('number', 42).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('null_string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('default', 42).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('null_boolean', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_number', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_decimal', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_string', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_date', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('null_boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('number', [1, 2, 3, 42]).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('null_string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('null_array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  expect(inserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('array.0', 1).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.1', 2).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.2', 3).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.3', date).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.4', new Decimal('0.001')).first())?.objectId).toBeUndefined();

  expect((await q.clone().every('array', q => q.notEqualTo('$', 3)).first())?.objectId).toBeUndefined();
  expect((await q.clone().some('array', q => q.equalTo('$', null)).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSubset('array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSubset('array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isDisjoint('array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSuperset('array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isIntersect('array', [4, 5, 6]).first())?.objectId).toBeUndefined();

  expect((await q.clone().containsIn('array.0', [1, 2, 3, 42, 'hello']).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('array.0', 4).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.1', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.2', 6).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.3', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.4', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('array', q => q.equalTo('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.notEqualTo('$', null)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().isSubset('array', [1, 2, 3, 4, 5, 6, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isDisjoint('array', [4, 5, 6]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isSuperset('array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isIntersect('array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 3', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
  });
  expect(inserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    array: [1, 2, 3, date, new Decimal('0.001')],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('object.null', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 42).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('object.boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.number', 42).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('object.string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('object.string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('object.string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_string').first())?.objectId).toBeUndefined();

  expect((await q.clone().empty('object.array').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.null', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('object.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('object.string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('object.string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('object.string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('object.string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('object.string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('object.null_string').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEmpty('object.array').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('object.null_array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 4', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6]],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().size('array', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().size('array', 2).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.size('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6], new Date],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }, new Date],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test update types', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ boolean: { $set: false } }))?.get('boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ number: { $set: 64 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $set: new Decimal('0.002') } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ string: { $set: 'world' } }))?.get('string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ date: { $set: date2 } }))?.get('date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ number: { $inc: 2 } }))?.get('number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ decimal: { $inc: 1 } }))?.get('decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ number: { $dec: 2 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $dec: 1 } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ number: { $mul: 2 } }))?.get('number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ decimal: { $mul: 2 } }))?.get('decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ number: { $div: 2 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $div: 2 } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ number: { $min: 2 } }))?.get('number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ decimal: { $min: 0 } }))?.get('decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ date: { $min: date } }))?.get('date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ number: { $max: 10 } }))?.get('number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ decimal: { $max: 10 } }))?.get('decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ date: { $max: date2 } }))?.get('date')).toStrictEqual(date2);
})

test('test update types 2', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'object.boolean': { $set: false } }))?.get('object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'object.number': { $set: 64 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $set: new Decimal('0.002') } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'object.string': { $set: 'world' } }))?.get('object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'object.date': { $set: date2 } }))?.get('object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'object.number': { $inc: 2 } }))?.get('object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'object.decimal': { $inc: 1 } }))?.get('object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'object.number': { $dec: 2 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $dec: 1 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'object.number': { $mul: 2 } }))?.get('object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'object.decimal': { $mul: 2 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'object.number': { $div: 2 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $div: 2 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'object.number': { $min: 2 } }))?.get('object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'object.decimal': { $min: 0 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'object.date': { $min: date } }))?.get('object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'object.number': { $max: 10 } }))?.get('object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'object.decimal': { $max: 10 } }))?.get('object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'object.date': { $max: date2 } }))?.get('object.date')).toStrictEqual(date2);
})

test('test update types 3', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    array: [{
      object: {
        boolean: true,
        number: 42,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      },
    }],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'array.0.object.boolean': { $set: false } }))?.get('array.0.object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'array.0.object.number': { $set: 64 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $set: new Decimal('0.002') } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'array.0.object.string': { $set: 'world' } }))?.get('array.0.object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'array.0.object.date': { $set: date2 } }))?.get('array.0.object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'array.0.object.number': { $inc: 2 } }))?.get('array.0.object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $inc: 1 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $dec: 2 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $dec: 1 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $mul: 2 } }))?.get('array.0.object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $mul: 2 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $div: 2 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $div: 2 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $min: 2 } }))?.get('array.0.object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $min: 0 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'array.0.object.date': { $min: date } }))?.get('array.0.object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'array.0.object.number': { $max: 10 } }))?.get('array.0.object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $max: 10 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'array.0.object.date': { $max: date2 } }))?.get('array.0.object.date')).toStrictEqual(date2);
})

test('test update types 4', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [1, 2, 3],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ array: { $addToSet: [2, 3, 4] } }))?.get('array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ array: { $push: [4, 5] } }))?.get('array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ array: { $removeAll: [4] } }))?.get('array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ array: { $popFirst: 1 } }))?.get('array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ array: { $popLast: 1 } }))?.get('array')).toStrictEqual([2, 3]);
})

test('test update types 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    object: {
      array: [1, 2, 3],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'object.array': { $addToSet: [2, 3, 4] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'object.array': { $push: [4, 5] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $removeAll: [4] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $popFirst: 1 } }))?.get('object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $popLast: 1 } }))?.get('object.array')).toStrictEqual([2, 3]);
})

test('test update types 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{
      object: {
        array: [1, 2, 3],
      },
    }],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'array.0.object.array': { $addToSet: [2, 3, 4] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $push: [4, 5] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $removeAll: [4] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $popFirst: 1 } }))?.get('array.0.object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $popLast: 1 } }))?.get('array.0.object.array')).toStrictEqual([2, 3]);
})

test('test update types 7', async () => {
  const obj1 = await Proto.Query('Test').insert({});
  const obj2 = await Proto.Query('Test').insert({});
  const obj3 = await Proto.Query('Test').insert({});
  const obj4 = await Proto.Query('Test').insert({});
  const obj5 = await Proto.Query('Test').insert({});
  const inserted = await Proto.Query('Test').insert({
    relation: [obj1, obj2, obj3],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation');

  expect((await q.clone().updateOne({ relation: { $addToSet: [obj2, obj3, obj4] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ relation: { $push: [obj4, obj5] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4, obj5].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ relation: { $removeAll: [obj4] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj5].map(x => x.objectId).sort());
})

test('test pointer', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('pointer', 'pointer2')
    .updateOne({
      pointer: { $set: inserted },
      pointer2: { $set: inserted },
    });

  expect(updated?.get('pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer.number')).toStrictEqual(42);
  expect(updated?.get('pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer.string')).toStrictEqual('hello');
  expect(updated?.get('pointer.date')).toStrictEqual(date);

  expect(updated?.get('pointer2.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer2.number')).toStrictEqual(42);
  expect(updated?.get('pointer2.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer2.string')).toStrictEqual('hello');
  expect(updated?.get('pointer2.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('pointer');

  expect((await q.clone().equalTo('pointer', inserted).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.date', date).first())?.objectId).toStrictEqual(inserted.objectId);
})

test('test pointer 2', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    pointer: invalid,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('pointer');

  expect((await q.clone().equalTo('pointer', null).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('*', 'relation')
    .updateOne({
      relation: { $set: [inserted] },
    });

  expect(updated?.get('relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation.0.number')).toStrictEqual(42);
  expect(updated?.get('relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().equalTo('relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation2')
    .updateOne({
      pointer: { $set: inserted },
    });

  expect(updated?.get('relation2').length).toStrictEqual(1);
  expect(updated?.get('relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation2.0.number')).toStrictEqual(42);
  expect(updated?.get('relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation2.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation2');

  expect((await q.clone().equalTo('relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 3', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation3')
    .updateOne({
      relation: { $set: [inserted] },
    });

  expect(updated?.get('relation3').length).toStrictEqual(1);
  expect(updated?.get('relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation3.0.number')).toStrictEqual(42);
  expect(updated?.get('relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation3.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation3');

  expect((await q.clone().equalTo('relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 4', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    relation: [invalid],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation');

  expect((await q.clone().equalTo('relation', []).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('relation', 0).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test update', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({});
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      boolean: { $set: true },
      number: { $set: 42 },
      decimal: { $set: new Decimal('0.001') },
      string: { $set: 'hello' },
      date: { $set: date },
      object: {
        $set: {
          boolean: true,
          number: 42,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      array: { $set: [1, 2, 3, date, new Decimal('0.001')] },
    });
  expect(updated?.objectId).toStrictEqual(inserted.objectId);
  expect(updated?.__v).toStrictEqual(1);
  expect(updated?.get('boolean')).toStrictEqual(true);
  expect(updated?.get('number')).toStrictEqual(42);
  expect(updated?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('string')).toStrictEqual('hello');
  expect(updated?.get('date')).toStrictEqual(date);
  expect(updated?.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert', async () => {
  const date = new Date;
  const upserted = await Proto.Query('Test')
    .equalTo('_id', '')
    .upsertOne({ string: { $set: 'update' } }, {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      object: {
        boolean: true,
        number: 42,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      },
      array: [1, 2, 3, date, new Decimal('0.001')],
    });
  expect(upserted.objectId).toBeTruthy();
  expect(upserted.__v).toStrictEqual(0);
  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({});
  const upserted = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .upsertOne({
      boolean: { $set: true },
      number: { $set: 42 },
      decimal: { $set: new Decimal('0.001') },
      string: { $set: 'hello' },
      date: { $set: date },
      object: {
        $set: {
          boolean: true,
          number: 42,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      array: { $set: [1, 2, 3, date, new Decimal('0.001')] },
    }, { string: 'insert' });
  expect(upserted.objectId).toStrictEqual(inserted.objectId);
  expect(upserted.__v).toStrictEqual(1);
  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test match', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of [1, 2, 3, 4, 5]) {
    await Proto.Query('Test').insert({
      number: i,
      decimal: new Decimal(`0.00${i}`),
      pointer: parent,
    });
  }

  const matched = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .greaterThan('number', 1)
      .sort({ _created_at: 1 })
      .limit(1))
    .first();

  expect(matched?.get('relation2').length).toStrictEqual(1);
  expect(matched?.get('relation2.0.number')).toStrictEqual(2);

  const matched2 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .sort({ _created_at: -1 })
      .limit(1))
    .first();

  expect(matched2?.get('relation2').length).toStrictEqual(1);
  expect(matched2?.get('relation2.0.number')).toStrictEqual(5);

  const matched3 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q.equalTo('decimal', new Decimal(`0.002`)))
    .first();

  expect(matched3?.get('relation2').length).toStrictEqual(1);
  expect(matched3?.get('relation2.0.number')).toStrictEqual(2);

  const matched4 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .sort({ decimal: -1 })
      .limit(1))
    .first();

  expect(matched4?.get('relation2').length).toStrictEqual(1);
  expect(matched4?.get('relation2.0.number')).toStrictEqual(5);

})

test('test comparable', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().lessThan('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThan('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('object.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('object.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('object.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test permission', async () => {
  await expect(() => Proto.Query('Test').insert({ no_permission: true })).rejects.toThrow('No permission');
  await expect(() => Proto.Query('Test').includes('no_permission').find()).rejects.toThrow('No permission');
})

test('test permission 2', async () => {
  await expect(() => Proto.Query('Test').insert({ no_permission: true })).rejects.toThrow('No permission');
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').insert({ no_permission: true })).toBeTruthy();
  await Proto.logout();
})

test('test permission 3', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeTruthy();
  await Proto.logout();
})

test('test permission 4', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: [] });
  object.push('_rperm', ['role:admin']);
  await object.save({ master: true });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeTruthy();
  await Proto.logout();
})
