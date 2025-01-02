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

test('test expr', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, string: 'expr' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'expr')
    .filter({ $expr: { $gt: [{ $key: 'number' }, { $value: 3 }] } })
    .find();

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(4, 10));
})

test('test expr 2', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, decimal: new Decimal(i), string: 'expr2' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'expr2')
    .filter({
      $expr: {
        $gt: [
          { $array: [{ $key: 'number' }, { $key: 'decimal' }] },
          { $array: [{ $value: 3 }, { $value: new Decimal(2) }] },
        ]
      }
    })
    .find();

  const result2 = await Proto.Query('Test').equalTo('string', 'expr2')
    .filter({
      $expr: {
        $gt: [
          { $array: [{ $key: 'number' }, { $key: 'decimal' }] },
          { $value: [3, 4] },
        ]
      }
    })
    .find();

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(3, 10));
  expect(_.map(result2, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(4, 10));
})
