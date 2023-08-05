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

test('test explain', async () => {

  console.dir(await proto.Query('Test', { master: true }).includes(
    '_id',
    'user._id',
    'tests._id',
    'tests.tests._id',
    'tests.tests.tests._id',
    'tests.tests.tests.tests._id',
  ).sort({
    '_id': 1,
  }).explain(), { depth: null });
});

test('test insert', async () => {
  const inserted = await proto.Query('Test').insert({ value: 'hello' });
  expect(inserted?.objectId).toBeTruthy();
  expect(inserted?.get('value')).toStrictEqual('hello');
})

test('test upsert', async () => {
  const inserted = await proto.Query('Test').insert({});
  const upserted = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .upsertOne({ value: [UpdateOp.set, 'update'] }, { value: 'insert' });
  expect(upserted?.objectId).toBeTruthy();
  expect(upserted?.get('value')).toStrictEqual('update');
})
