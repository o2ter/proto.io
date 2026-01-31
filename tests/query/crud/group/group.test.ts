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
import Decimal from 'decimal.js';
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

test('test group matches with $group accumulator - stdDev', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 2 }),
      await Proto.Query('Test').insert({ string: 'A', number: 4 }),
      await Proto.Query('Test').insert({ string: 'A', number: 4 }),
      await Proto.Query('Test').insert({ string: 'A', number: 4 }),
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 7 }),
      await Proto.Query('Test').insert({ string: 'A', number: 9 }),
      await Proto.Query('Test').insert({ string: 'B', number: 10 }),
      await Proto.Query('Test').insert({ string: 'B', number: 20 }),
      await Proto.Query('Test').insert({ string: 'B', number: 30 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $stdDevPop: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBeGreaterThan(1);
  expect(groupedMap.A).toBeLessThan(3);
  expect(groupedMap.B).toBeGreaterThan(5);
  expect(groupedMap.B).toBeLessThan(10);
});

test('test group matches with $group accumulator - variance', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'A', number: 20 }),
      await Proto.Query('Test').insert({ string: 'A', number: 30 }),
      await Proto.Query('Test').insert({ string: 'A', number: 40 }),
      await Proto.Query('Test').insert({ string: 'B', number: 5 }),
      await Proto.Query('Test').insert({ string: 'B', number: 10 }),
      await Proto.Query('Test').insert({ string: 'B', number: 15 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      groupedPop: {
        $group: {
          key: { $key: 'string' },
          value: { $varPop: { $key: 'number' } },
        },
      },
      groupedSamp: {
        $group: {
          key: { $key: 'string' },
          value: { $varSamp: { $key: 'number' } },
        },
      },
    })
    .first();

  const groupedPop = result?.get('relation.groupedPop');
  const groupedSamp = result?.get('relation.groupedSamp');
  expect(groupedPop).toBeDefined();
  expect(groupedSamp).toBeDefined();
  expect(Array.isArray(groupedPop)).toBe(true);
  expect(Array.isArray(groupedSamp)).toBe(true);

  const popMap = Object.fromEntries(groupedPop.map((item: any) => [item.key, item.value]));
  const sampMap = Object.fromEntries(groupedSamp.map((item: any) => [item.key, item.value]));

  expect(popMap.A).toBeGreaterThan(0);
  expect(sampMap.A).toBeGreaterThan(0);
  expect(sampMap.A).toBeGreaterThanOrEqual(popMap.A);
  expect(popMap.B).toBeGreaterThan(0);
  expect(sampMap.B).toBeGreaterThan(0);
});

test('test group matches with $group accumulator - most', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 3 }),
      await Proto.Query('Test').insert({ string: 'A', number: 7 }),
      await Proto.Query('Test').insert({ string: 'B', number: 10 }),
      await Proto.Query('Test').insert({ string: 'B', number: 10 }),
      await Proto.Query('Test').insert({ string: 'B', number: 20 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $most: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBe(5);
  expect(groupedMap.B).toBe(10);
});

test('test group matches with $group accumulator - percentile', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 1 }),
      await Proto.Query('Test').insert({ string: 'A', number: 2 }),
      await Proto.Query('Test').insert({ string: 'A', number: 3 }),
      await Proto.Query('Test').insert({ string: 'A', number: 4 }),
      await Proto.Query('Test').insert({ string: 'A', number: 5 }),
      await Proto.Query('Test').insert({ string: 'A', number: 6 }),
      await Proto.Query('Test').insert({ string: 'A', number: 7 }),
      await Proto.Query('Test').insert({ string: 'A', number: 8 }),
      await Proto.Query('Test').insert({ string: 'A', number: 9 }),
      await Proto.Query('Test').insert({ string: 'A', number: 10 }),
      await Proto.Query('Test').insert({ string: 'B', number: 100 }),
      await Proto.Query('Test').insert({ string: 'B', number: 200 }),
      await Proto.Query('Test').insert({ string: 'B', number: 300 }),
      await Proto.Query('Test').insert({ string: 'B', number: 400 }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'string' },
          value: { $percentile: { input: { $key: 'number' }, p: 0.5, mode: 'continuous' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.A).toBeGreaterThanOrEqual(5);
  expect(groupedMap.A).toBeLessThanOrEqual(6);
  expect(groupedMap.B).toBeGreaterThanOrEqual(200);
  expect(groupedMap.B).toBeLessThanOrEqual(300);
});

test('test group matches with $group accumulator - decimal operations', async () => {

  const Decimal = (await import('decimal.js')).default;

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', decimal: new Decimal('10.5') }),
      await Proto.Query('Test').insert({ string: 'A', decimal: new Decimal('20.25') }),
      await Proto.Query('Test').insert({ string: 'A', decimal: new Decimal('30.75') }),
      await Proto.Query('Test').insert({ string: 'B', decimal: new Decimal('100.1') }),
      await Proto.Query('Test').insert({ string: 'B', decimal: new Decimal('200.2') }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      groupedSum: {
        $group: {
          key: { $key: 'string' },
          value: { $sum: { $key: 'decimal' } },
        },
      },
      groupedAvg: {
        $group: {
          key: { $key: 'string' },
          value: { $avg: { $key: 'decimal' } },
        },
      },
    })
    .first();

  const groupedSum = result?.get('relation.groupedSum');
  const groupedAvg = result?.get('relation.groupedAvg');
  expect(groupedSum).toBeDefined();
  expect(groupedAvg).toBeDefined();

  const sumMap = Object.fromEntries(groupedSum.map((item: any) => [item.key, item.value]));
  const avgMap = Object.fromEntries(groupedAvg.map((item: any) => [item.key, item.value]));

  expect(new Decimal(sumMap.A).toNumber()).toBeCloseTo(61.5, 2);
  expect(new Decimal(avgMap.A).toNumber()).toBeCloseTo(20.5, 2);
  expect(new Decimal(sumMap.B).toNumber()).toBeCloseTo(300.3, 2);
  expect(new Decimal(avgMap.B).toNumber()).toBeCloseTo(150.15, 2);
});

test('test group matches with $group accumulator - empty relation', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [],
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
      total: { $count: true },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  const total = result?.get('relation.total');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  expect(grouped.length).toBe(0);
  expect(typeof total).toBe('number');
  expect(total).toBe(0);
});

test('test group matches with $group accumulator - multiple accumulators', async () => {

  const Decimal = (await import('decimal.js')).default;

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10, decimal: new Decimal(5) }),
      await Proto.Query('Test').insert({ string: 'A', number: 20, decimal: new Decimal(15) }),
      await Proto.Query('Test').insert({ string: 'A', number: 30, decimal: new Decimal(25) }),
      await Proto.Query('Test').insert({ string: 'B', number: 100, decimal: new Decimal(50) }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      count: { $count: true },
      sumNumber: { $sum: { $key: 'number' } },
      avgNumber: { $avg: { $key: 'number' } },
      minNumber: { $min: { $key: 'number' } },
      maxNumber: { $max: { $key: 'number' } },
      sumDecimal: { $sum: { $key: 'decimal' } },
    })
    .first();

  const count = result?.get('relation.count');
  const sumNumber = result?.get('relation.sumNumber');
  const avgNumber = result?.get('relation.avgNumber');
  const minNumber = result?.get('relation.minNumber');
  const maxNumber = result?.get('relation.maxNumber');
  const sumDecimal = result?.get('relation.sumDecimal');

  expect(typeof count).toBe('number');
  expect(count).toBe(4);
  expect(sumNumber).toBe(160);
  expect(avgNumber).toBe(40);
  expect(minNumber).toBe(10);
  expect(maxNumber).toBe(100);
  expect(new Decimal(sumDecimal).toNumber()).toBe(95);
});

test('test group matches with $group accumulator - with nested conditions', async () => {

  const parent = await Proto.Query('Test').insert({
    relation: [
      await Proto.Query('Test').insert({ string: 'A', number: 10, boolean: true }),
      await Proto.Query('Test').insert({ string: 'A', number: 20, boolean: true }),
      await Proto.Query('Test').insert({ string: 'A', number: 30, boolean: false }),
      await Proto.Query('Test').insert({ string: 'B', number: 40, boolean: true }),
      await Proto.Query('Test').insert({ string: 'B', number: 50, boolean: false }),
    ],
  });

  const result = await Proto.Query('Test')
    .equalTo('_id', parent.id)
    .groupMatches('relation', {
      grouped: {
        $group: {
          key: { $key: 'boolean' },
          value: { $sum: { $key: 'number' } },
        },
      },
    })
    .first();

  const grouped = result?.get('relation.grouped');
  expect(grouped).toBeDefined();
  expect(Array.isArray(grouped)).toBe(true);
  const groupedMap = Object.fromEntries(grouped.map((item: any) => [item.key, item.value]));
  expect(groupedMap.true).toBe(70); // 10 + 20 + 40
  expect(groupedMap.false).toBe(80); // 30 + 50
});
