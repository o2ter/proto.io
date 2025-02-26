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

test('test each batch', async () => {
  const inserted = await Proto.Query('Test').insertMany([
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
  ]);
  expect(inserted.length).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch').eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.id).length).toStrictEqual(5);
  expect(counter).toStrictEqual(3);
})
test('test each batch 2', async () => {
  const inserted = await Proto.Query('Test').insertMany([
    { string: 'eachBatch2', number: 1 },
    { string: 'eachBatch2', number: 2 },
    { string: 'eachBatch2', number: 3 },
    { string: 'eachBatch2', number: 4 },
    { string: 'eachBatch2', number: 5 },
  ]);
  expect(inserted.length).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch2').sort({ number: 1 }).eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.id).length).toStrictEqual(5);
  expect(_.map(result, x => x.get('number'))).toStrictEqual([1, 2, 3, 4, 5]);
  expect(counter).toStrictEqual(3);
})

test('test each batch 3', async () => {
  const inserted = await Proto.Query('Test').insertMany([
    { string: 'eachBatch3', number: 1 },
    { string: 'eachBatch3', number: 2 },
    { string: 'eachBatch3', number: 3 },
    { string: 'eachBatch3', number: 4 },
    { string: 'eachBatch3', number: 5 },
  ]);
  expect(inserted.length).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch3').sort({ _created_at: 1 }).eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.id).length).toStrictEqual(5);
  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
  expect(counter).toStrictEqual(3);
})
