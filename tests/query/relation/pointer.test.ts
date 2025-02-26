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

test('test pointer', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42.5,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.id)
    .includes('pointer', 'pointer2', 'shape.pointer', 'shape.pointer2')
    .updateOne({
      pointer: { $set: inserted },
      pointer2: { $set: inserted },
      'shape.pointer': { $set: inserted },
      'shape.pointer2': { $set: inserted },
    });

  expect(updated?.get('pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer.number')).toStrictEqual(42.5);
  expect(updated?.get('pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer.string')).toStrictEqual('hello');
  expect(updated?.get('pointer.date')).toStrictEqual(date);

  expect(updated?.get('pointer2.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer2.number')).toStrictEqual(42.5);
  expect(updated?.get('pointer2.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer2.string')).toStrictEqual('hello');
  expect(updated?.get('pointer2.date')).toStrictEqual(date);

  expect(updated?.get('shape.pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.pointer.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.pointer.string')).toStrictEqual('hello');
  expect(updated?.get('shape.pointer.date')).toStrictEqual(date);

  expect(updated?.get('shape.pointer2.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.pointer2.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.pointer2.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.pointer2.string')).toStrictEqual('hello');
  expect(updated?.get('shape.pointer2.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.id).includes('pointer');

  expect((await q.clone().equalTo('pointer', inserted).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('pointer.boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('pointer.number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('pointer.decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('pointer.string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('pointer.date', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('shape.pointer', inserted).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer.boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer.number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer.decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer.string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer.date', date).first())?.id).toStrictEqual(inserted.id);
})

test('test pointer 2', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    pointer: invalid,
    shape: {
      pointer: invalid,
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id).includes('pointer');

  expect((await q.clone().equalTo('pointer', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.pointer', null).first())?.id).toStrictEqual(inserted.id);

})
