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
  socketEndpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test job without scope', async () => {

  await Promise.all([
    Proto.scheduleJob('TestJob', { number: 1 }),
    Proto.scheduleJob('TestJob', { number: 2 }),
    Proto.scheduleJob('TestJob', { number: 3 }),
  ]);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const result = await Proto.Query('Test').find({ master: true });

  expect(result.length).toEqual(3);
  expect(_.map(result, x => x.get('params.number')).sort()).toEqual([1, 2, 3]);

})

test('test job with scope', async () => {

  await Promise.all([
    Proto.scheduleJob('TestJobScope', { number: 1 }),
    Proto.scheduleJob('TestJobScope', { number: 2 }),
    Proto.scheduleJob('TestJobScope', { number: 3 }),
  ]);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const result = await Proto.Query('Test').find({ master: true });

  expect(result.length).toEqual(1);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const result2 = await Proto.Query('Test').find({ master: true });

  expect(result2.length).toEqual(2);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const result3 = await Proto.Query('Test').find({ master: true });

  expect(result3.length).toEqual(3);
  expect(_.map(result3, x => x.get('params.number')).sort()).toEqual([1, 2, 3]);

})
