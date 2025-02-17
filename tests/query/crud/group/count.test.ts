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
import { masterUser } from '../../server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test group matches count', async () => {

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
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('relation.count')).toBe(5);

})

test('test group matches count 2', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .groupMatches('relation2', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('relation2.count')).toBe(5);

})

test('test group matches count 3', async () => {

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
    .groupMatches('shape.relation', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('shape.relation.count')).toBe(5);

})

test('test group matches count 4', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .groupMatches('shape.relation2', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('shape.relation2.count')).toBe(5);

})

test('test group matches count 5', async () => {

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
    .groupMatches('pointer.relation', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('pointer.relation.count')).toBe(5);

})

test('test group matches count 6', async () => {

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
    .groupMatches('pointer.relation2', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('pointer.relation2.count')).toBe(6);

})

test('test group matches count 7', async () => {

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
    .groupMatches('pointer.shape.relation', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('pointer.shape.relation.count')).toBe(5);

})

test('test group matches count 8', async () => {

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
    .groupMatches('pointer.shape.relation2', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('pointer.shape.relation2.count')).toBe(6);

})

test('test group matches count 9', async () => {

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
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result?.get('relation.count')).toBe(5);

  const result2 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .every('relation', q => q.equalTo('number', 42))
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result2?.get('relation.count')).toBeUndefined();

  const result3 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result3?.get('relation.count')).toBe(3);

  const result4 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation.count', 3)
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result4?.get('relation.count')).toBe(3);

  const result5 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation.count', 5)
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result5?.get('relation.count')).toBeUndefined();

  const result6 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .notEmpty('relation')
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result6?.get('relation.count')).toBe(3);

  const result7 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .match('relation', q => q.equalTo('number', 42))
    .empty('relation')
    .groupMatches('relation', {
      count: { $count: true },
    })
    .first();

  expect(result7?.get('relation.count')).toBeUndefined();

})
