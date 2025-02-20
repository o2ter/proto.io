//
//  index.test.ts
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
import { masterUser } from '../server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test expr with $add', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $add: [{ $key: 'number' }, { $value: 1 }] },
          { $value: 2 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $add 2', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $add: [{ $key: 'number' }, { $value: 1 }] },
          { $value: 1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBeUndefined();

})

test('test expr with $multiply', async () => {

  const object = await Proto.Query('Test').insert({ number: 2 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $multiply: [{ $key: 'number' }, { $value: 2 }] },
          { $value: 4 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $ifNull', async () => {

  const object = await Proto.Query('Test').insert({ number: null });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $ifNull: [{ $key: 'number' }, { $value: 1 }] },
          { $value: 1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $concat', async () => {

  const object = await Proto.Query('Test').insert({ string: 'Hello' });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $concat: [{ $key: 'string' }, { $value: ' World' }] },
          { $value: 'Hello World' },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $mod', async () => {

  const object = await Proto.Query('Test').insert({ number: 10 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $mod: [{ $key: 'number' }, { $value: 3 }] },
          { $value: 1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $log', async () => {

  const object = await Proto.Query('Test').insert({ number: 100 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $log: [{ $key: 'number' }] },
          { $value: Math.log(100) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $pow', async () => {

  const object = await Proto.Query('Test').insert({ number: 2 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $pow: [{ $key: 'number' }, { $value: 3 }] },
          { $value: 8 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $divide', async () => {

  const object = await Proto.Query('Test').insert({ number: 10 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $divide: [{ $key: 'number' }, { $value: 2 }] },
          { $value: 5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $subtract', async () => {

  const object = await Proto.Query('Test').insert({ number: 10 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $subtract: [{ $key: 'number' }, { $value: 3 }] },
          { $value: 7 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $trunc', async () => {

  const object = await Proto.Query('Test').insert({ number: 5.67 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $trunc: [{ $key: 'number' }] },
          { $value: 5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $atan2', async () => {

  const object = await Proto.Query('Test').insert({ y: 1, x: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $atan2: [{ $key: 'y' }, { $key: 'x' }] },
          { $value: Math.atan2(1, 1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})