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

test('test update', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({});
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      boolean: { $set: true },
      number: { $set: 42.5 },
      decimal: { $set: new Decimal('0.001') },
      string: { $set: 'hello' },
      date: { $set: date },
      object: {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      array: { $set: [1, 2, 3, date, new Decimal('0.001')] },
      'shape.boolean': { $set: true },
      'shape.number': { $set: 42.5 },
      'shape.decimal': { $set: new Decimal('0.001') },
      'shape.string': { $set: 'hello' },
      'shape.date': { $set: date },
      'shape.object': {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      'shape.array': { $set: [1, 2, 3, date, new Decimal('0.001')] },
    });

  expect(updated?.objectId).toStrictEqual(inserted.objectId);
  expect(updated?.__v).toStrictEqual(1);

  expect(updated?.get('boolean')).toStrictEqual(true);
  expect(updated?.get('number')).toStrictEqual(42.5);
  expect(updated?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('string')).toStrictEqual('hello');
  expect(updated?.get('date')).toStrictEqual(date);
  expect(updated?.get('object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  expect(updated?.get('shape.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.string')).toStrictEqual('hello');
  expect(updated?.get('shape.date')).toStrictEqual(date);
  expect(updated?.get('shape.object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('shape.array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})
