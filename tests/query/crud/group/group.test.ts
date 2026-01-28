//
//  group.test.ts
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
import { ProtoClient } from '../../../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test group matches with $group accumulator - count by string', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A' }),
      await Proto.Query('Test').insert({ string: 'A' }),
      await Proto.Query('Test').insert({ string: 'B' }),
      await Proto.Query('Test').insert({ string: 'B' }),
      await Proto.Query('Test').insert({ string: 'B' }),
      await Proto.Query('Test').insert({ string: 'C' }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $count: true },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  console.log('grouped:', JSON.stringify(grouped), 'isArray:', Array.isArray(grouped));
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(2);
  expect(groupedMap.B).toBe(3);
  expect(groupedMap.C).toBe(1);
});

test('test group matches with $group accumulator - sum by string', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'A', number: 20 }),
      await Proto.Query('Test').insert({ string: 'B', number: 30 }),
      await Proto.Query('Test').insert({ string: 'B', number: 40 }),
      await Proto.Query('Test').insert({ string: 'C', number: 50 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $sum: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(30);
  expect(groupedMap.B).toBe(70);
  expect(groupedMap.C).toBe(50);
});

test('test group matches with $group accumulator - avg by string', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'A', number: 20 }),
      await Proto.Query('Test').insert({ string: 'B', number: 30 }),
      await Proto.Query('Test').insert({ string: 'B', number: 40 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $avg: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(15);
  expect(groupedMap.B).toBe(35);
});

test('test group matches with $group accumulator - max by string', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'A', number: 25 }),
      await Proto.Query('Test').insert({ string: 'B', number: 30 }),
      await Proto.Query('Test').insert({ string: 'B', number: 45 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $max: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(25);
  expect(groupedMap.B).toBe(45);
});

test('test group matches with $group accumulator - min by string', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'A', number: 25 }),
      await Proto.Query('Test').insert({ string: 'B', number: 30 }),
      await Proto.Query('Test').insert({ string: 'B', number: 45 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $min: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(10);
  expect(groupedMap.B).toBe(30);
});

test('test group matches with $group accumulator - with relation2', async () => {

  const parent = await Proto.Query('Test').insert({});
  for (const str of ['X', 'X', 'Y', 'Y', 'Y']) {
    await Proto.Query('Test').insert({
      pointer: parent,
      string: str,
      number: str === 'X' ? 100 : 200,
    });
  }

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation2', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $sum: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation2.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.X).toBe(200);
  expect(groupedMap.Y).toBe(600);
});
