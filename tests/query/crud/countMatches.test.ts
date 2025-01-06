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

test('test count matches', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .countMatches('relation')
    .first();

  expect(result?.get('relation')).toBe(5);

})

test('test count matches 2', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .countMatches('relation2')
    .first();

  expect(result?.get('relation2')).toBe(5);

})

test('test count matches 3', async () => {

  const parent = await Proto.Query('Test').insert({
    shape: {
      relation: [
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
      ],
    }
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .countMatches('shape.relation')
    .first();

  expect(result?.get('shape.relation')).toBe(5);

})

test('test count matches 4', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .countMatches('shape.relation2')
    .first();

  expect(result?.get('shape.relation2')).toBe(5);

})

test('test count matches 5', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({}),
    ],
  });

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.objectId)
    .countMatches('pointer.relation')
    .first();

  expect(result?.get('pointer.relation')).toBe(5);

})

test('test count matches 6', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.objectId)
    .countMatches('pointer.relation2')
    .first();

  expect(result?.get('pointer.relation2')).toBe(6);

})

test('test count matches 7', async () => {

  const parent = await Proto.Query('Test').insert({
    shape: {
      relation: [
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
        await Proto.Query('Test').insert({}),
      ],
    }
  });

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.objectId)
    .countMatches('pointer.shape.relation')
    .first();

  expect(result?.get('pointer.shape.relation')).toBe(5);

})

test('test count matches 8', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.objectId)
    .countMatches('pointer.shape.relation2')
    .first();

  expect(result?.get('pointer.shape.relation2')).toBe(6);

})

test('test count matches 9', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ number: 42 }),
      await Proto.Query('Test').insert({}),
      await Proto.Query('Test').insert({ number: 42 }),
      await Proto.Query('Test').insert({ number: 42 }),
      await Proto.Query('Test').insert({}),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .some('relation', q => q.equalTo('number', 42))
    .countMatches('relation')
    .first();

  expect(result?.get('relation')).toBe(5);

  const result2 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .every('relation', q => q.equalTo('number', 42))
    .countMatches('relation')
    .first();

  expect(result2?.get('relation')).toBeUndefined();

  const result3 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .countMatches('relation')
    .first();

  expect(result3?.get('relation')).toBe(3);

  const result4 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation', 3)
    .countMatches('relation')
    .first();

  expect(result4?.get('relation')).toBe(3);

  const result5 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation', 5)
    .countMatches('relation')
    .first();

  expect(result5?.get('relation')).toBeUndefined();

  const result6 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .notEmpty('relation')
    .countMatches('relation')
    .first();

  expect(result6?.get('relation')).toBe(3);

  const result7 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .empty('relation')
    .countMatches('relation')
    .first();

  expect(result7?.get('relation')).toBeUndefined();

})
