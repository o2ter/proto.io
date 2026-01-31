//
//  groupFind.test.ts
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

test('test groupFind - count', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'count_test' },
    { number: 20, string: 'count_test' },
    { number: 30, string: 'count_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'count_test')
    .groupFind({
      total: { $count: true },
    });

  expect(typeof result.total).toBe('number');
  expect(result.total).toBe(3);
});

test('test groupFind - sum', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'sum_test' },
    { number: 20, string: 'sum_test' },
    { number: 30, string: 'sum_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'sum_test')
    .groupFind({
      total: { $sum: { $key: 'number' } },
    });

  expect(result.total).toBe(60);
});

test('test groupFind - avg', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'avg_test' },
    { number: 20, string: 'avg_test' },
    { number: 30, string: 'avg_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'avg_test')
    .groupFind({
      average: { $avg: { $key: 'number' } },
    });

  expect(result.average).toBe(20);
});

test('test groupFind - min and max', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'minmax_test' },
    { number: 50, string: 'minmax_test' },
    { number: 30, string: 'minmax_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'minmax_test')
    .groupFind({
      minimum: { $min: { $key: 'number' } },
      maximum: { $max: { $key: 'number' } },
    });

  expect(result.minimum).toBe(10);
  expect(result.maximum).toBe(50);
});

test('test groupFind - multiple accumulators', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, decimal: new Decimal(5), string: 'multi_test' },
    { number: 20, decimal: new Decimal(15), string: 'multi_test' },
    { number: 30, decimal: new Decimal(25), string: 'multi_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'multi_test')
    .groupFind({
      count: { $count: true },
      sumNumber: { $sum: { $key: 'number' } },
      avgNumber: { $avg: { $key: 'number' } },
      minNumber: { $min: { $key: 'number' } },
      maxNumber: { $max: { $key: 'number' } },
      sumDecimal: { $sum: { $key: 'decimal' } },
    });

  expect(typeof result.count).toBe('number');
  expect(result.count).toBe(3);
  expect(result.sumNumber).toBe(60);
  expect(result.avgNumber).toBe(20);
  expect(result.minNumber).toBe(10);
  expect(result.maxNumber).toBe(30);
  expect(new Decimal(result.sumDecimal).toNumber()).toBe(45);
});

test('test groupFind - with filter', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'filter_test', boolean: true },
    { number: 20, string: 'filter_test', boolean: true },
    { number: 30, string: 'filter_test', boolean: false },
    { number: 40, string: 'filter_test', boolean: false },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'filter_test')
    .equalTo('boolean', true)
    .groupFind({
      count: { $count: true },
      sum: { $sum: { $key: 'number' } },
    });

  expect(typeof result.count).toBe('number');
  expect(result.count).toBe(2);
  expect(result.sum).toBe(30);
});

test('test groupFind - stdDev', async () => {
  // Insert test data with known standard deviation
  await Proto.Query('Test').insertMany([
    { number: 2, string: 'stddev_test' },
    { number: 4, string: 'stddev_test' },
    { number: 4, string: 'stddev_test' },
    { number: 4, string: 'stddev_test' },
    { number: 5, string: 'stddev_test' },
    { number: 5, string: 'stddev_test' },
    { number: 7, string: 'stddev_test' },
    { number: 9, string: 'stddev_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'stddev_test')
    .groupFind({
      stdDevPop: { $stdDevPop: { $key: 'number' } },
      stdDevSamp: { $stdDevSamp: { $key: 'number' } },
    });

  // The standard deviation should be around 2
  expect(result.stdDevPop).toBeGreaterThan(1);
  expect(result.stdDevPop).toBeLessThan(3);
  expect(result.stdDevSamp).toBeGreaterThan(1);
  expect(result.stdDevSamp).toBeLessThan(3);
});

test('test groupFind - variance', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'var_test' },
    { number: 20, string: 'var_test' },
    { number: 30, string: 'var_test' },
    { number: 40, string: 'var_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'var_test')
    .groupFind({
      varPop: { $varPop: { $key: 'number' } },
      varSamp: { $varSamp: { $key: 'number' } },
    });

  expect(result.varPop).toBeGreaterThan(0);
  expect(result.varSamp).toBeGreaterThan(0);
  // Sample variance should be greater than population variance for small samples
  expect(result.varSamp).toBeGreaterThanOrEqual(result.varPop);
});

test('test groupFind - most', async () => {
  // Insert test data where 5 appears most frequently
  await Proto.Query('Test').insertMany([
    { string: 'most_test', number: 3 },
    { string: 'most_test', number: 5 },
    { string: 'most_test', number: 5 },
    { string: 'most_test', number: 5 },
    { string: 'most_test', number: 7 },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'most_test')
    .groupFind({
      mostCommon: { $most: { $key: 'number' } },
    });

  expect(result.mostCommon).toBe(5);
});

test('test groupFind - with x and y fields', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { x: 10, y: 5, string: 'xy_test' },
    { x: 20, y: 10, string: 'xy_test' },
    { x: 30, y: 15, string: 'xy_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'xy_test')
    .groupFind({
      sumX: { $sum: { $key: 'x' } },
      sumY: { $sum: { $key: 'y' } },
      avgX: { $avg: { $key: 'x' } },
    });

  expect(result.sumX).toBe(60);
  expect(result.sumY).toBe(30);
  expect(result.avgX).toBe(20);
});

test('test groupFind - empty result', async () => {
  const result = await Proto.Query('Test')
    .equalTo('string', 'nonexistent_value_xyz')
    .groupFind({
      count: { $count: true },
      sum: { $sum: { $key: 'number' } },
    });

  expect(typeof result.count).toBe('number');
  expect(result.count).toBe(0);
  expect(result.sum).toBe(null);
});

test('test groupFind - with limit and skip', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 10, string: 'limit_test' },
    { number: 20, string: 'limit_test' },
    { number: 30, string: 'limit_test' },
    { number: 40, string: 'limit_test' },
    { number: 50, string: 'limit_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'limit_test')
    .sort({ number: 1 })
    .skip(1)
    .limit(3)
    .groupFind({
      count: { $count: true },
      sum: { $sum: { $key: 'number' } },
      min: { $min: { $key: 'number' } },
      max: { $max: { $key: 'number' } },
    });

  expect(typeof result.count).toBe('number');
  expect(result.count).toBe(3);
  expect(result.sum).toBe(90); // 20 + 30 + 40
  expect(result.min).toBe(20);
  expect(result.max).toBe(40);
});

test('test groupFind - percentile', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { number: 1, string: 'percentile_test' },
    { number: 2, string: 'percentile_test' },
    { number: 3, string: 'percentile_test' },
    { number: 4, string: 'percentile_test' },
    { number: 5, string: 'percentile_test' },
    { number: 6, string: 'percentile_test' },
    { number: 7, string: 'percentile_test' },
    { number: 8, string: 'percentile_test' },
    { number: 9, string: 'percentile_test' },
    { number: 10, string: 'percentile_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'percentile_test')
    .groupFind({
      median: { $percentile: { input: { $key: 'number' }, p: 0.5, mode: 'continuous' } },
      p75: { $percentile: { input: { $key: 'number' }, p: 0.75, mode: 'discrete' } },
    });

  expect(result.median).toBeGreaterThanOrEqual(5);
  expect(result.median).toBeLessThanOrEqual(6);
  expect(result.p75).toBeGreaterThanOrEqual(7);
  expect(result.p75).toBeLessThanOrEqual(8);
});

test('test groupFind - decimal operations', async () => {
  // Insert test data
  await Proto.Query('Test').insertMany([
    { decimal: new Decimal('10.5'), string: 'decimal_test' },
    { decimal: new Decimal('20.25'), string: 'decimal_test' },
    { decimal: new Decimal('30.75'), string: 'decimal_test' },
  ]);

  const result = await Proto.Query('Test')
    .equalTo('string', 'decimal_test')
    .groupFind({
      sum: { $sum: { $key: 'decimal' } },
      avg: { $avg: { $key: 'decimal' } },
      min: { $min: { $key: 'decimal' } },
      max: { $max: { $key: 'decimal' } },
    });

  expect(new Decimal(result.sum).toNumber()).toBeCloseTo(61.5, 2);
  expect(new Decimal(result.avg).toNumber()).toBeCloseTo(20.5, 2);
  expect(new Decimal(result.min).toNumber()).toBeCloseTo(10.5, 2);
  expect(new Decimal(result.max).toNumber()).toBeCloseTo(30.75, 2);
});
