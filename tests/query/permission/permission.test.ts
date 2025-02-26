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

test('test permission', async () => {
  await expect(() => Proto.Query('Test').insert({ no_permission: true })).rejects.toThrow('No permission');
  await expect(() => Proto.Query('Test').includes('no_permission').find()).rejects.toThrow('No permission');
})

test('test permission 2', async () => {
  await expect(() => Proto.Query('Test').insert({ no_permission: true })).rejects.toThrow('No permission');
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').insert({ no_permission: true })).toBeTruthy();
  await Proto.logout();
})

test('test permission 3', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  expect(await Proto.Query('Test').get(object.id!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.id!)).toBeTruthy();
  await Proto.logout();
})

test('test permission 4', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: [] });
  object.push('_rperm', ['role:admin']);
  await object.save({ master: true });
  expect(await Proto.Query('Test').get(object.id!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.id!)).toBeTruthy();
  await Proto.logout();
})

test('test additional permission', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  expect(await Proto.Query('Test').get(object.id!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'system' });
  expect(await Proto.Query('Test').get(object.id!)).toBeTruthy();
  await Proto.logout();
})

test('test relation permission', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  const object2 = await Proto.Query('Test').insert({ pointer: object });
  const result = await Proto.Query('Test').includes('pointer').get(object2.id!);
  expect(result?.get('pointer')).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  const result2 = await Proto.Query('Test').includes('pointer').get(object2.id!);
  expect(result2?.get('pointer')).toBeTruthy();
  await Proto.logout();
})

test('test relation permission 2', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  const object2 = await Proto.Query('Test').insert({ relation: [object] });
  const result = await Proto.Query('Test').includes('relation').get(object2.id!);
  expect(_.first(result?.get('relation'))).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  const result2 = await Proto.Query('Test').includes('relation').get(object2.id!);
  expect(_.first(result2?.get('relation'))).toBeTruthy();
  await Proto.logout();
})

test('test relation permission 3', async () => {
  const object2 = await Proto.Query('Test').insert({});
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'], pointer: object2 });
  const result = await Proto.Query('Test').includes('relation2').get(object2.id!);
  expect(_.first(result?.get('relation2'))).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  const result2 = await Proto.Query('Test').includes('relation2').get(object2.id!);
  expect(_.first(result2?.get('relation2'))).toBeTruthy();
  await Proto.logout();
})

test('test relation permission 4', async () => {
  const object2 = await Proto.Query('Test').insert({});
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'], relation: [object2] });
  const result = await Proto.Query('Test').includes('relation3').get(object2.id!);
  expect(_.first(result?.get('relation3'))).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  const result2 = await Proto.Query('Test').includes('relation3').get(object2.id!);
  expect(_.first(result2?.get('relation3'))).toBeTruthy();
  await Proto.logout();
})

test('test relation permission 5', async () => {
  const inserted = await Proto.Query('Relation').insert({
  });
  const inserted2 = await Proto.Query('Relation2').insert({
    relation: [inserted],
  });
  const inserted3 = await Proto.Query('Relation3').insert({
    relation: [inserted2],
    _rperm: ['role:admin']
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

  const q = Proto.Query('Relation').equalTo('_id', inserted.id);

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.id).sort()).toStrictEqual([]);

  await Proto.run('createUserWithRole', { role: 'admin' });

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.id).sort()).toStrictEqual([inserted7.id].sort());

  await Proto.logout();

}, 60000)

test('test relation permission 6', async () => {
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
    _rperm: ['role:admin']
  });
  const inserted7 = await Proto.Query('Relation7').insert({
    pointer: inserted6,
  });

  const q = Proto.Query('Relation').equalTo('_id', inserted.id);

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.id).sort()).toStrictEqual([]);

  await Proto.run('createUserWithRole', { role: 'admin' });

  expect(_.map((await q.clone().includes('relation7').first())?.get('relation7'), x => x.id).sort()).toStrictEqual([inserted7.id].sort());

  await Proto.logout();

}, 60000)
