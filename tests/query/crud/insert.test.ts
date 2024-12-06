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
import { masterUser } from '../server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test insert', async () => {
  const inserted = await Proto.Query('Test').insert({ string: 'hello', 'shape.string': 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('shape.string')).toStrictEqual('hello');
})

test('test insert 2', async () => {
  const obj = Proto.Object('Test');
  obj.set('string', 'hello');
  obj.set('shape.string', 'hello');

  await obj.save();

  expect(obj.objectId).toBeTruthy();
  expect(obj.get('string')).toStrictEqual('hello');
  expect(obj.get('shape.string')).toStrictEqual('hello');
})

test('test insert many', async () => {
  const count = await Proto.Query('Test').insertMany([
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
  ]);
  expect(count).toStrictEqual(4);

  const result = await Proto.Query('Test').equalTo('string', 'insertMany').find();
  expect(result.length).toStrictEqual(4);

  for (const item of result) {
    expect(item.get('string')).toStrictEqual('insertMany');
    expect(item.get('shape.string')).toStrictEqual('insertMany');
  }
})
