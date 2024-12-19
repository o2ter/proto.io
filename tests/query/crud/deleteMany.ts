//
//  index.test.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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

test('test delete many', async () => {
  const inserted = await Proto.Query('Test').insertMany([
    { string: 'deleteMany', number: 1 },
    { string: 'deleteMany', number: 2 },
    { string: 'deleteMany', number: 3 },
    { string: 'deleteMany', number: 4 },
    { string: 'deleteMany', number: 5 },
  ]);

  expect(inserted).toStrictEqual(5);

  const deleted = await Proto.Query('Test')
    .equalTo('string', 'deleteMany')
    .greaterThan('number', 2)
    .deleteMany();

  expect(deleted).toStrictEqual(3);

  const result = await Proto.Query('Test').equalTo('string', 'deleteMany').find();

  expect(_.map(result, x => x.get('number')).sort()).toStrictEqual([1, 2]);
})
