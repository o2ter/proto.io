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

import { masterKey } from './server';
import fs from 'fs';
import { test, expect } from '@jest/globals';
import { UUID } from 'bson';
import Decimal from 'decimal.js';
import ProtoClient, { UpdateOp } from '../../src/client';

const proto = new ProtoClient({
  endpoint: 'http://localhost:8080',
  masterKey,
});

test('echo', async () => {
  const result = await proto.run('echo', 'hello, world');
  expect(result).toStrictEqual('hello, world');
});
test('test codec', async () => {

  const obj = {
    hello: 'world',
    $array: [1, 2, null, { string: '' }],
    decimal: new Decimal('10.05'),
    date: new Date(),
    uuid: new UUID(),
  };

  const result = await proto.run('echo', obj);
  expect(result).toStrictEqual(obj);
});
test('test files', async () => {
  const file = proto.File('test.txt', 'hello, world', 'text/plain');
  await file.save();
});
test('test files 2', async () => {
  const file = proto.File('test.txt', fs.createReadStream(__filename), 'text/plain');
  await file.save();
});

test('test insert', async () => {
  const inserted = await proto.Query('Test').insert({ string: 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('hello');
})

test('test types', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
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
  expect(inserted.get('boolean')).toStrictEqual(true);
  expect(inserted.get('number')).toStrictEqual(42);
  expect(inserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('date')).toStrictEqual(date);
  expect(inserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(inserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  expect((await proto.Query('Test').equalTo('boolean', true).first())?.get('boolean')).toStrictEqual(true);
  expect((await proto.Query('Test').equalTo('number', 42).first())?.get('number')).toStrictEqual(42);
  expect((await proto.Query('Test').equalTo('decimal', new Decimal('0.001')).first())?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect((await proto.Query('Test').equalTo('string', 'hello').first())?.get('string')).toStrictEqual('hello');
  expect((await proto.Query('Test').equalTo('date', date).first())?.get('date')).toStrictEqual(date);

  expect((await proto.Query('Test').equalTo('object.boolean', true).first())?.get('object.boolean')).toStrictEqual(true);
  expect((await proto.Query('Test').equalTo('object.number', 42).first())?.get('object.number')).toStrictEqual(42);
  expect((await proto.Query('Test').equalTo('object.decimal', new Decimal('0.001')).first())?.get('object.decimal')).toStrictEqual(new Decimal('0.001'));
  expect((await proto.Query('Test').equalTo('object.string', 'hello').first())?.get('object.string')).toStrictEqual('hello');
  expect((await proto.Query('Test').equalTo('object.date', date).first())?.get('object.date')).toStrictEqual(date);

  expect((await proto.Query('Test').equalTo('array.0', 1).first())?.get('array.0')).toStrictEqual(1);
  expect((await proto.Query('Test').equalTo('array.1', 2).first())?.get('array.1')).toStrictEqual(2);
  expect((await proto.Query('Test').equalTo('array.2', 3).first())?.get('array.2')).toStrictEqual(3);
  expect((await proto.Query('Test').equalTo('array.3', date).first())?.get('array.3')).toStrictEqual(date);
  expect((await proto.Query('Test').equalTo('array.4', new Decimal('0.001')).first())?.get('array.4')).toStrictEqual(new Decimal('0.001'));

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('boolean', true).first())?.get('boolean')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('number', 42).first())?.get('number')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('decimal', new Decimal('0.001')).first())?.get('decimal')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('string', 'hello').first())?.get('string')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('date', date).first())?.get('date')).toBe(undefined);

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.boolean', true).first())?.get('object.boolean')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.number', 42).first())?.get('object.number')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.decimal', new Decimal('0.001')).first())?.get('object.decimal')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.string', 'hello').first())?.get('object.string')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.date', date).first())?.get('object.date')).toBe(undefined);

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.0', 1).first())?.get('array.0')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.1', 2).first())?.get('array.1')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.2', 3).first())?.get('array.2')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.3', date).first())?.get('array.3')).toBe(undefined);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.4', new Decimal('0.001')).first())?.get('array.4')).toBe(undefined);

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('boolean', false).first())?.get('boolean')).toStrictEqual(true);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('number', 10).first())?.get('number')).toStrictEqual(42);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('decimal', new Decimal('1.001')).first())?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('string', 'world').first())?.get('string')).toStrictEqual('hello');
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('date', new Date).first())?.get('date')).toStrictEqual(date);

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.boolean', false).first())?.get('object.boolean')).toStrictEqual(true);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.number', 10).first())?.get('object.number')).toStrictEqual(42);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.decimal', new Decimal('1.001')).first())?.get('object.decimal')).toStrictEqual(new Decimal('0.001'));
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.string', 'world').first())?.get('object.string')).toStrictEqual('hello');
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('object.date', new Date).first())?.get('object.date')).toStrictEqual(date);

  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.0', 4).first())?.get('array.0')).toStrictEqual(1);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.1', 5).first())?.get('array.1')).toStrictEqual(2);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.2', 6).first())?.get('array.2')).toStrictEqual(3);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.3', new Date).first())?.get('array.3')).toStrictEqual(date);
  expect((await proto.Query('Test').equalTo('_id', inserted.objectId).notEqualTo('array.4', new Decimal('1.001')).first())?.get('array.4')).toStrictEqual(new Decimal('0.001'));
})

test('test upsert', async () => {
  const upserted = await proto.Query('Test')
    .equalTo('_id', '')
    .upsertOne({ string: [UpdateOp.set, 'update'] }, { string: 'insert' });
  expect(upserted?.objectId).toBeTruthy();
  expect(upserted?.get('string')).toStrictEqual('insert');
})

test('test upsert 2', async () => {
  const inserted = await proto.Query('Test').insert({});
  const upserted = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .upsertOne({ string: [UpdateOp.set, 'update'] }, { string: 'insert' });
  expect(upserted?.objectId).toStrictEqual(inserted.objectId);
  expect(upserted?.get('string')).toStrictEqual('update');
})
