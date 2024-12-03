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

test('test transaction', async () => {

  const object = await Proto.Query('Test').insert({});

  const result1 = await Proto.run('updateWithTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect(result1).toStrictEqual({ success: false, error: 'test error' });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toBeNull();

  const result2 = await Proto.run('updateWithTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect(result2).toStrictEqual({ success: true, error: null });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test nested transaction', async () => {

  const object = await Proto.Query('Test').insert({});

  await Proto.run('updateWithNestedTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 0
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(0);

  await Proto.run('updateWithNestedTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 1
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test long transaction', async () => {

  const object = await Proto.Query('Test').insert({ number: 0 });

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([2, 4, 6, 8, 10]);
})

test('test long transaction 2', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);
})

test('test long transaction 3', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})

test('test transaction session', async () => {

  const object = await Proto.Query('Test').insert({});

  const result1 = await Proto.run('updateWithTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect(result1).toStrictEqual({ success: false, error: 'test error' });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toBeNull();

  const result2 = await Proto.run('updateWithTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect(result2).toStrictEqual({ success: true, error: null });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test nested transaction session', async () => {

  const object = await Proto.Query('Test').insert({});

  await Proto.run('updateWithNestedTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 0
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(0);

  await Proto.run('updateWithNestedTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 1
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test long transaction session', async () => {

  const object = await Proto.Query('Test').insert({ number: 0 });

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([2, 4, 6, 8, 10]);
})

test('test long transaction session 2', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);
})

test('test long transaction session 3', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})
