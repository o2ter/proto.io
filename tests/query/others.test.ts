//
//  index.test.ts
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
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test count', async () => {
  await Proto.Query('Test').insert({});
  const count = await Proto.Query('Test').count();
  expect(count).toBeGreaterThan(0);
})

test('test field name', async () => {
  const inserted = await Proto.Query('Test').insert({ 'test_field-name': 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('test_field-name')).toStrictEqual('hello');
})

test('test destroy', async () => {
  const inserted = await Proto.Query('Test').insert({ string: 'destroy' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('destroy');
  await inserted.destroy();
  const result = await Proto.Query('Test').equalTo('string', 'destroy').find();
  expect(result).toStrictEqual([]);
})

test('test save keys', async () => {
  const inserted = await Proto.Query('Test').insert({});

  const obj = Proto.Object('Test');
  obj.set('pointer', inserted);
  obj.set('shape', { pointer: inserted });
  await obj.save();

  expect(obj.get('pointer')?.objectId).toStrictEqual(inserted.objectId);
  expect(obj.get('shape.pointer')?.objectId).toStrictEqual(inserted.objectId);
})

test('test save keys 2', async () => {
  const inserted = await Proto.Query('Test').insert({});

  const obj = Proto.Object('Test');
  obj.set('relation', [inserted]);
  obj.set('shape', { relation: [inserted] });
  await obj.save();

  expect(obj.get('relation')?.[0]?.objectId).toStrictEqual(inserted.objectId);
  expect(obj.get('shape.relation')?.[0]?.objectId).toStrictEqual(inserted.objectId);
})

test('test save keys 3', async () => {
  const obj = await Proto.Query('Test').insert({});
  obj.set('shape', {
    number: 42,
    string: 'hello',
  });
  await obj.save();

  expect(obj.get('shape.number')).toStrictEqual(42);
  expect(obj.get('shape.string')).toStrictEqual('hello');
})
