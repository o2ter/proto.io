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
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test distance', async () => {

  const inserted = await Proto.Query('Vector').insert({
    vector: {
      x: 0,
      y: 1,
      z: 2,
    },
  });

  const q = Proto.Query('Vector').equalTo('_id', inserted.objectId);

  expect((await q.clone().filter({
    $expr: {
      $lt: [
        {
          $distance: [
            [{ $key: 'vector.x' }, { $key: 'vector.y' }, { $key: 'vector.z' }],
            { $value: [0, 0, 0] },
          ]
        },
        { $value: 2.3 },
      ],
    },
  }).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().filter({
    $expr: {
      $lt: [
        {
          $distance: [
            [{ $key: 'vector.x' }, { $key: 'vector.y' }, { $key: 'vector.z' }],
            { $value: [0, 0, 0] },
          ]
        },
        { $value: 2.2 },
      ],
    },
  }).first())?.objectId).toBeUndefined();

});

test('test distance 2', async () => {

  const inserted = await Proto.Query('Vector').insert({
    vector2: [0, 1, 2],
  });

  const q = Proto.Query('Vector').equalTo('_id', inserted.objectId);

  expect((await q.clone().filter({
    $expr: {
      $lt: [
        {
          $distance: [
            { $key: 'vector2' },
            { $value: [0, 0, 0] },
          ]
        },
        { $value: 2.3 },
      ],
    },
  }).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().filter({
    $expr: {
      $lt: [
        {
          $distance: [
            { $key: 'vector2' },
            { $value: [0, 0, 0] },
          ]
        },
        { $value: 2.2 },
      ],
    },
  }).first())?.objectId).toBeUndefined();

});

test('test distance sort', async () => {

  for (const x of _.range(5)) {
    await Proto.Query('Vector').insert({
      string: 'distance sort',
      vector: {
        x: x,
        y: 1,
        z: 2,
      },
    });
  }

  const result = await Proto.Query('Vector').equalTo('string', 'distance sort').sort([{
    order: -1,
    expr: {
      $distance: [
        [{ $key: 'vector.x' }, { $key: 'vector.y' }, { $key: 'vector.z' }],
        { $value: [0, 0, 0] },
      ]
    },
  }]).find();

  expect(result.length).toStrictEqual(5);
  expect(result[0].get('vector.x')).toStrictEqual(4);
  expect(result[1].get('vector.x')).toStrictEqual(3);
  expect(result[2].get('vector.x')).toStrictEqual(2);
  expect(result[3].get('vector.x')).toStrictEqual(1);
  expect(result[4].get('vector.x')).toStrictEqual(0);

});

test('test distance sort 2', async () => {

  for (const x of _.range(5)) {
    await Proto.Query('Vector').insert({
      string: 'distance sort 2',
      vector2: [x, 1, 2],
    });
  }

  const result = await Proto.Query('Vector').equalTo('string', 'distance sort 2').sort([{
    order: -1,
    expr: {
      $distance: [
        { $key: 'vector2' },
        { $value: [0, 0, 0] },
      ]
    },
  }]).find();

  expect(result.length).toStrictEqual(5);
  expect(result[0].get('vector2.0')).toStrictEqual(4);
  expect(result[1].get('vector2.0')).toStrictEqual(3);
  expect(result[2].get('vector2.0')).toStrictEqual(2);
  expect(result[3].get('vector2.0')).toStrictEqual(1);
  expect(result[4].get('vector2.0')).toStrictEqual(0);

});
