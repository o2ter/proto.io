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

test('test group matches sum', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ number: 1 }),
      await Proto.Query('Test').insert({ number: 2 }),
      await Proto.Query('Test').insert({ number: 3 }),
      await Proto.Query('Test').insert({ number: 4 }),
      await Proto.Query('Test').insert({ number: 5 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      value: { $sum: { $key: 'number' } },
    })
    .sort({ 'relation.value': 1 })
    .first();

  expect(result?.get('relation.value')).toBe(15);

})

test('test group matches sum 2', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      number: i,
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation2', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('relation2.value')).toBe(15);

})

test('test group matches sum 3', async () => {

  const parent = await Proto.Query('Test').insert({
    shape: {
      relation: [
        await Proto.Query('Test').insert({ number: 1 }),
        await Proto.Query('Test').insert({ number: 2 }),
        await Proto.Query('Test').insert({ number: 3 }),
        await Proto.Query('Test').insert({ number: 4 }),
        await Proto.Query('Test').insert({ number: 5 }),
      ],
    }
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('shape.relation', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('shape.relation.value')).toBe(15);

})

test('test group matches sum 4', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      number: i,
      pointer: parent,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('shape.relation2', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('shape.relation2.value')).toBe(15);

})

test('test group matches sum 5', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ number: 1 }),
      await Proto.Query('Test').insert({ number: 2 }),
      await Proto.Query('Test').insert({ number: 3 }),
      await Proto.Query('Test').insert({ number: 4 }),
      await Proto.Query('Test').insert({ number: 5 }),
    ],
  });

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.id)
    .groupMatches('pointer.relation', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('pointer.relation.value')).toBe(15);

})

test('test group matches sum 6', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      number: i,
      pointer: parent,
    });
  }

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.id)
    .groupMatches('pointer.relation2', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('pointer.relation2.value')).toBe(15);

})

test('test group matches sum 7', async () => {

  const parent = await Proto.Query('Test').insert({
    shape: {
      relation: [
        await Proto.Query('Test').insert({ number: 1 }),
        await Proto.Query('Test').insert({ number: 2 }),
        await Proto.Query('Test').insert({ number: 3 }),
        await Proto.Query('Test').insert({ number: 4 }),
        await Proto.Query('Test').insert({ number: 5 }),
      ],
    }
  });

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.id)
    .groupMatches('pointer.shape.relation', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('pointer.shape.relation.value')).toBe(15);

})

test('test group matches sum 8', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const i of _.range(1, 6)) {
    await Proto.Query('Test').insert({
      number: i,
      pointer: parent,
    });
  }

  const parent2 = await Proto.Query('Test').insert({
    pointer: parent,
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent2.id)
    .groupMatches('pointer.shape.relation2', {
      value: { $sum: { $key: 'number' } },
    })
    .first();

  expect(result?.get('pointer.shape.relation2.value')).toBe(15);

})

test('test group matches sum 9', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ decimal: 1, number: 42 }),
      await Proto.Query('Test').insert({ decimal: 2 }),
      await Proto.Query('Test').insert({ decimal: 3, number: 42 }),
      await Proto.Query('Test').insert({ decimal: 4, number: 42 }),
      await Proto.Query('Test').insert({ decimal: 5 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .some('relation', q => q.equalTo('number', 42))
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result?.get('relation.value')?.toNumber()).toBe(15);

  const result2 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .every('relation', q => q.equalTo('number', 42))
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result2?.get('relation.value')).toBeUndefined();

  const result3 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .match('relation', q => q.equalTo('number', 42))
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result3?.get('relation.value')?.toNumber()).toBe(8);

  const result4 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation.value', 8)
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result4?.get('relation.value')?.toNumber()).toBe(8);

  const result5 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .match('relation', q => q.equalTo('number', 42))
    .equalTo('relation.value', 15)
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result5?.get('relation.value')).toBeUndefined();

  const result6 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .match('relation', q => q.equalTo('number', 42))
    .notEmpty('relation')
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result6?.get('relation.value')?.toNumber()).toBe(8);

  const result7 = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .match('relation', q => q.equalTo('number', 42))
    .empty('relation')
    .groupMatches('relation', {
      value: { $sum: { $key: 'decimal' } },
    })
    .first();

  expect(result7?.get('relation.value')).toBeUndefined();

})
