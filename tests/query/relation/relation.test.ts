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

test('test relation', async () => {
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
    .equalTo('_id', inserted.objectId)
    .includes('*', 'relation', 'shape.relation')
    .updateOne({
      relation: { $set: [inserted] },
      'shape.relation': { $set: [inserted] },
    });

  expect(updated?.get('relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().equalTo('relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 2', async () => {
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
    .equalTo('_id', inserted.objectId)
    .includes('relation2', 'shape.relation2')
    .updateOne({
      pointer: { $set: inserted },
      'shape.pointer': { $set: inserted },
    });

  expect(updated?.get('relation2').length).toStrictEqual(1);
  expect(updated?.get('relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation2.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation2.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation2').length).toStrictEqual(1);
  expect(updated?.get('shape.relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation2.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation2.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation2');

  expect((await q.clone().equalTo('relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 3', async () => {
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
    .equalTo('_id', inserted.objectId)
    .includes('relation3', 'shape.relation3')
    .updateOne({
      relation: { $set: [inserted] },
      'shape.relation': { $set: [inserted] },
    });

  expect(updated?.get('relation3').length).toStrictEqual(1);
  expect(updated?.get('relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation3.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation3.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation3').length).toStrictEqual(1);
  expect(updated?.get('shape.relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation3.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation3.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation3');

  expect((await q.clone().equalTo('relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 4', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    relation: [invalid],
    shape: {
      relation: [invalid],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation');

  expect((await q.clone().equalTo('relation', []).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('relation', 0).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation', []).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('shape.relation', 0).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().equalTo('relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
})

test('test relation 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().some('relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 6b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted2.objectId);

  expect((await q.clone().some('pointer.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().some('pointer.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().some('pointer.shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().some('pointer.shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().every('pointer.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().every('pointer.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().every('pointer.shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().every('pointer.shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().some('relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('shape.relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

}, 60000)

test('test relation 7b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted2.objectId);

  expect((await q.clone().some('pointer.relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().some('pointer.relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().some('pointer.shape.relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().some('pointer.shape.relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().every('pointer.relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().every('pointer.relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);

  expect((await q.clone().every('pointer.shape.relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().every('pointer.shape.relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted2.objectId);

}, 60000)

test('test relation 8', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation4').first())?.get('relation4'), x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());

}, 60000)

test('test relation 9', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted_b = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation5').first())?.get('relation5'), x => x.objectId).sort()).toStrictEqual([inserted4.objectId].sort());

}, 60000)

test('test relation 9b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted3_b = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted4_b = await Proto.Query('Test').insert({
    pointer: inserted3_b,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation5').first())?.get('relation5'), x => x.objectId).sort()).toStrictEqual([inserted4.objectId, inserted4_b.objectId].sort());

}, 60000)

test('test relation 10', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted_b = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted2_b = await Proto.Query('Test').insert({
    relation: [inserted_b],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2, inserted2_b],
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation6').first())?.get('relation6'), x => x.objectId).sort()).toStrictEqual([inserted5.objectId].sort());

}, 60000)

test('test relation 10b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted4_b = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });
  const inserted5_b = await Proto.Query('Test').insert({
    pointer: inserted4_b,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation6').first())?.get('relation6'), x => x.objectId).sort()).toStrictEqual([inserted5.objectId, inserted5_b.objectId].sort());

}, 60000)

test('test relation 11', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Test').insert({
    relation: [inserted3],
  });
  const inserted5 = await Proto.Query('Test').insert({
    relation: [inserted4],
  });
  const inserted6 = await Proto.Query('Test').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Test').insert({
    pointer: inserted6,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation 12', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted3 = await Proto.Query('Test').insert({
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
    pointer: inserted3,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation8').first())?.get('relation8'), x => x.objectId).sort()).toStrictEqual([inserted5.objectId].sort());

}, 60000)

test('test relation 13', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted5 = await Proto.Query('Test').insert({
  });
  const inserted4 = await Proto.Query('Test').insert({
    relation: [inserted3],
    pointer: inserted5,
  });
  const inserted6 = await Proto.Query('Test').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Test').insert({
    pointer: inserted6,
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation9').first())?.get('relation9'), x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation 14', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation').first())?.get('relation'), x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());

}, 60000)

test('test relation 15', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Relation4').insert({
    relation: [inserted3],
  });
  const inserted5 = await Proto.Query('Relation5').insert({
    relation: [inserted4],
  });
  const inserted6 = await Proto.Query('Relation6').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Relation7').insert({
    pointer: inserted6,
  });

  const q = Proto.Query('Relation').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation 16', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });
  const inserted5 = await Proto.Query('Relation5').insert({
  });
  const inserted4 = await Proto.Query('Relation4').insert({
    relation: [inserted3],
    pointer: inserted5,
  });
  const inserted6 = await Proto.Query('Relation6').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Relation7').insert({
    pointer: inserted6,
  });

  const q = Proto.Query('Relation').equalTo('_id', inserted.objectId);

  expect(_.map((await q.clone().includes('relation9').first())?.get('relation9'), x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation query', async () => {

  await Proto.Query('Test').insertMany([
    { number: 1 },
    { number: 2 },
    { number: 3 },
    { number: 4 },
  ]);

  const objs = await Proto.Query('Test').find();

  const inserted = await Proto.Query('Test').insert({
    relation: objs,
  });

  const result = await objs[0].relation('relation').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await inserted.relation('relation').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test relation query 2', async () => {

  await Proto.Query('Test').insertMany([
    { number: 1 },
    { number: 2 },
    { number: 3 },
    { number: 4 },
  ]);

  const objs = await Proto.Query('Test').find();

  const inserted = await Proto.Query('Test').insert({
    'shape.relation': objs,
  });

  const result = await objs[0].relation('shape.relation').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await inserted.relation('shape.relation').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test relation query 3', async () => {

  const inserted = await Proto.Query('Test').insert({});

  await Proto.Query('Test').insertMany([
    { number: 1, pointer: inserted },
    { number: 2, pointer: inserted },
    { number: 3, pointer: inserted },
    { number: 4, pointer: inserted },
  ]);

  const objs = await Proto.Query('Test').equalTo('pointer', inserted).find();

  const result = await objs[0].relation('relation2').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await inserted.relation('relation2').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test relation query 4', async () => {

  const inserted = await Proto.Query('Test').insert({});

  await Proto.Query('Test').insertMany([
    { number: 1, relation: [inserted] },
    { number: 2, relation: [inserted] },
    { number: 3, relation: [inserted] },
    { number: 4, relation: [inserted] },
  ]);

  const objs = await Proto.Query('Test').isSuperset('relation', [inserted]).find();

  const result = await objs[0].relation('relation3').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await inserted.relation('relation3').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test relation query 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });

  const result = await inserted.relation('relation4').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());

}, 60000)

test('test relation query 5b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });

  const result = await inserted.relation('relation2.relation2').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());
})

test('test relation query 5c', async () => {
  const inserted2 = await Proto.Query('Test').insert({});
  const inserted = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });

  const result = await inserted.relation('pointer.relation2').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted.objectId, inserted3.objectId].sort());
})

test('test relation query 5d', async () => {
  const inserted2 = await Proto.Query('Test').insert({});
  const inserted = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2],
  });

  const result = await inserted.relation('pointer.relation3').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());
})

test('test relation query 6', async () => {

  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted_b = await Proto.Query('Test').insert({
    number: 42.5,
  });

  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted, inserted_b],
  });

  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });

  const result = await inserted.relation('relation5').find();
  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted4.objectId].sort());
}, 60000)

test('test relation query 6b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted3_b = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted4_b = await Proto.Query('Test').insert({
    pointer: inserted3_b,
  });

  const result = await inserted.relation('relation5').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted4.objectId, inserted4_b.objectId].sort());

}, 60000)

test('test relation query 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted_b = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted2_b = await Proto.Query('Test').insert({
    relation: [inserted_b],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2, inserted2_b],
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });

  const result = await inserted.relation('relation6').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted5.objectId].sort());

}, 60000)

test('test relation query 7b', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted4_b = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });
  const inserted5_b = await Proto.Query('Test').insert({
    pointer: inserted4_b,
  });

  const result = await inserted.relation('relation6').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted5.objectId, inserted5_b.objectId].sort());

}, 60000)

test('test relation query 8', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Test').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Test').insert({
    relation: [inserted3],
  });
  const inserted5 = await Proto.Query('Test').insert({
    relation: [inserted4],
  });
  const inserted6 = await Proto.Query('Test').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Test').insert({
    pointer: inserted6,
  });

  const result = await inserted.relation('relation7').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation query 9', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted3 = await Proto.Query('Test').insert({
  });
  const inserted2 = await Proto.Query('Test').insert({
    relation: [inserted],
    pointer: inserted3,
  });
  const inserted4 = await Proto.Query('Test').insert({
    pointer: inserted3,
  });
  const inserted5 = await Proto.Query('Test').insert({
    pointer: inserted4,
  });

  const result = await inserted.relation('relation8').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted5.objectId].sort());

}, 60000)

test('test relation query 10', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  const inserted2 = await Proto.Query('Test').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Test').insert({
    pointer: inserted2,
  });
  const inserted5 = await Proto.Query('Test').insert({
  });
  const inserted4 = await Proto.Query('Test').insert({
    relation: [inserted3],
    pointer: inserted5,
  });
  const inserted6 = await Proto.Query('Test').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Test').insert({
    pointer: inserted6,
  });

  const result = await inserted.relation('relation9').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation query 11', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const result = await inserted.relation('relation').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted3.objectId].sort());

}, 60000)

test('test relation query 12', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });
  const inserted4 = await Proto.Query('Relation4').insert({
    relation: [inserted3],
  });
  const inserted5 = await Proto.Query('Relation5').insert({
    relation: [inserted4],
  });
  const inserted6 = await Proto.Query('Relation6').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Relation7').insert({
    pointer: inserted6,
  });

  const result = await inserted.relation('relation7').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)

test('test relation query 13', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });
  const inserted5 = await Proto.Query('Relation5').insert({
  });
  const inserted4 = await Proto.Query('Relation4').insert({
    relation: [inserted3],
    pointer: inserted5,
  });
  const inserted6 = await Proto.Query('Relation6').insert({
    pointer: inserted5,
  });
  const inserted7 = await Proto.Query('Relation7').insert({
    pointer: inserted6,
  });

  const result = await inserted.relation('relation9').find();

  expect(_.map(result, x => x.objectId).sort()).toStrictEqual([inserted7.objectId].sort());

}, 60000)
