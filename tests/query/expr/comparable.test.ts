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

test('test comparable', async () => {
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
    shape: {
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
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().lessThan('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().lessThan('shape.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('shape.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('shape.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('shape.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().greaterThan('shape.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('shape.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('shape.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThan('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('object.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('object.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().lessThan('shape.object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('shape.object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('shape.object.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('shape.object.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().greaterThan('shape.object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('shape.object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('shape.object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

})
