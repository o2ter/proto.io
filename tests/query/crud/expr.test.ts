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

test('test expr with $log', async () => {

  const object = await Proto.Query('Test').insert({ number: 100 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $log: [{ $key: 'number' }, { $value: 10 }] },
          { $value: Math.log(100) / Math.log(10) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $mod', async () => {

  const object = await Proto.Query('Test').insert({ number: 3.5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $mod: [{ $key: 'number' }, { $value: 1.5 }] },
          { $value: 0.5 },
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

test('test expr with $abs', async () => {

  const object = await Proto.Query('Test').insert({ number: -5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $abs: { $key: 'number' } },
          { $value: 5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $neg', async () => {

  const object = await Proto.Query('Test').insert({ number: 5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $neg: { $key: 'number' } },
          { $value: -5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $sqrt', async () => {

  const object = await Proto.Query('Test').insert({ number: 9 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $sqrt: { $key: 'number' } },
          { $value: 3 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $cbrt', async () => {

  const object = await Proto.Query('Test').insert({ number: 8 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $cbrt: { $key: 'number' } },
          { $value: 2 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $ceil', async () => {

  const object = await Proto.Query('Test').insert({ number: 4.2 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $ceil: { $key: 'number' } },
          { $value: 5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $floor', async () => {

  const object = await Proto.Query('Test').insert({ number: 4.8 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $floor: { $key: 'number' } },
          { $value: 4 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $round', async () => {

  const object = await Proto.Query('Test').insert({ number: 3.5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $round: { $key: 'number' } },
          { $value: 4 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $exp', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $exp: { $key: 'number' } },
          { $value: Math.exp(1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $ln', async () => {

  const object = await Proto.Query('Test').insert({ number: Math.E });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $ln: { $key: 'number' } },
          { $value: 1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $log2', async () => {

  const object = await Proto.Query('Test').insert({ number: 8 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $log2: { $key: 'number' } },
          { $value: 3 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $log10', async () => {

  const object = await Proto.Query('Test').insert({ number: 100 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $log10: { $key: 'number' } },
          { $value: 2 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $sin', async () => {

  const object = await Proto.Query('Test').insert({ number: Math.PI / 2 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $sin: { $key: 'number' } },
          { $value: 1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $cos', async () => {

  const object = await Proto.Query('Test').insert({ number: Math.PI });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $cos: { $key: 'number' } },
          { $value: -1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $tan', async () => {

  const object = await Proto.Query('Test').insert({ number: Math.PI / 4 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $tan: { $key: 'number' } },
          { $value: Math.tan(Math.PI / 4) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $asin', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $asin: { $key: 'number' } },
          { $value: Math.PI / 2 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $acos', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $acos: { $key: 'number' } },
          { $value: 0 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $atan', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $atan: { $key: 'number' } },
          { $value: Math.PI / 4 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $asinh', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $asinh: { $key: 'number' } },
          { $value: Math.asinh(1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $acosh', async () => {

  const object = await Proto.Query('Test').insert({ number: 2 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $acosh: { $key: 'number' } },
          { $value: Math.acosh(2) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $atanh', async () => {

  const object = await Proto.Query('Test').insert({ number: 0.5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $atanh: { $key: 'number' } },
          { $value: Math.atanh(0.5) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $sinh', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $sinh: { $key: 'number' } },
          { $value: Math.sinh(1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $cosh', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $cosh: { $key: 'number' } },
          { $value: Math.cosh(1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $tanh', async () => {

  const object = await Proto.Query('Test').insert({ number: 1 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $tanh: { $key: 'number' } },
          { $value: Math.tanh(1) },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $degrees', async () => {

  const object = await Proto.Query('Test').insert({ number: Math.PI });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $degrees: { $key: 'number' } },
          { $value: 180 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $radians', async () => {

  const object = await Proto.Query('Test').insert({ number: 180 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $radians: { $key: 'number' } },
          { $value: Math.PI },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $sign', async () => {

  const object = await Proto.Query('Test').insert({ number: -5 });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $sign: { $key: 'number' } },
          { $value: -1 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $size', async () => {

  const object = await Proto.Query('Test').insert({ string: 'Hello' });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $size: { $key: 'string' } },
          { $value: 5 },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $lower', async () => {

  const object = await Proto.Query('Test').insert({ string: 'HELLO' });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $lower: { $key: 'string' } },
          { $value: 'hello' },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})

test('test expr with $upper', async () => {

  const object = await Proto.Query('Test').insert({ string: 'hello' });

  const result = await Proto.Query('Test')
    .equalTo('_id', object.objectId)
    .filter({
      $expr: {
        $eq: [
          { $upper: { $key: 'string' } },
          { $value: 'HELLO' },
        ]
      }
    })
    .first();

  expect(result?.objectId).toBe(object.objectId);

})