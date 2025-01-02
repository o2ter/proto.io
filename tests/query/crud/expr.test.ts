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

test('test relation contains', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().containsIn('pointer', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().containsIn('pointer', [inserted]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation contains 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().containsIn('pointer.pointer', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().containsIn('pointer.pointer', [inserted]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation not contains', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().notContainsIn('pointer', [inserted]).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('pointer', [inserted_b]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation not contains 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    pointer: inserted,
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().notContainsIn('pointer.pointer', [inserted]).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('pointer.pointer', [inserted_b]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation intersect', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().isIntersect('relation', []).first())?.objectId).toBeUndefined();
  expect((await q.clone().isIntersect('relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isIntersect('relation', [inserted]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation intersect 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().isIntersect('pointer.relation', []).first())?.objectId).toBeUndefined();
  expect((await q.clone().isIntersect('pointer.relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isIntersect('pointer.relation', [inserted]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation superset', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().isSuperset('relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSuperset('relation', []).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().isSuperset('relation', [inserted]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation superset 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().isSuperset('pointer.relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSuperset('pointer.relation', []).first())?.objectId).toStrictEqual(inserted3.objectId);
  expect((await q.clone().isSuperset('pointer.relation', [inserted]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation subset', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().isSubset('relation', []).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSubset('relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSubset('relation', [inserted, inserted_b]).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().isSubset('relation', [inserted]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation subset 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().isSubset('pointer.relation', []).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSubset('pointer.relation', [inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSubset('pointer.relation', [inserted, inserted_b]).first())?.objectId).toStrictEqual(inserted3.objectId);
  expect((await q.clone().isSubset('pointer.relation', [inserted]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation disjoint', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().isDisjoint('relation', [inserted]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isDisjoint('relation', [inserted, inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isDisjoint('relation', []).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q.clone().isDisjoint('relation', [inserted_b]).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation disjoint 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted_b = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().isDisjoint('pointer.relation', [inserted]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isDisjoint('pointer.relation', [inserted, inserted_b]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isDisjoint('pointer.relation', []).first())?.objectId).toStrictEqual(inserted3.objectId);
  expect((await q.clone().isDisjoint('pointer.relation', [inserted_b]).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation every', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().every('relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation every 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().every('relation', x => x.equalTo('number', 42)).first())?.objectId).toBeUndefined();

})

test('test relation every 3', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().every('pointer.relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation every 4', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().every('pointer.relation', x => x.equalTo('number', 42)).first())?.objectId).toBeUndefined();

})

test('test relation every 5', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().every('relation', x => x.every('relation', x => x.equalTo('number', 42))).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation every 6', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().every('relation', x => x.every('relation', x => x.equalTo('number', 42))).first())?.objectId).toBeUndefined();

})

test('test relation some', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().some('relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation some 2', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });

  const q = Proto.Query('Relation2').equalTo('_id', inserted2.objectId);

  expect((await q.clone().some('relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted2.objectId);

})

test('test relation some 3', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().some('pointer.relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation some 4', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    pointer: inserted2,
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().some('pointer.relation', x => x.equalTo('number', 42)).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation some 5', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().some('relation', x => x.some('relation', x => x.equalTo('number', 42))).first())?.objectId).toStrictEqual(inserted3.objectId);

})

test('test relation some 6', async () => {

  const inserted = await Proto.Query('Relation').insert({
    number: 42,
  });
  const inserted_b = await Proto.Query('Relation').insert({
    number: 16,
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted, inserted_b],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
  });

  const q = Proto.Query('Relation3').equalTo('_id', inserted3.objectId);

  expect((await q.clone().some('relation', x => x.some('relation', x => x.equalTo('number', 42))).first())?.objectId).toStrictEqual(inserted3.objectId);

})
