//
//  index.test.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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

test('test permission field', async () => {

  await Proto.run('createUserWithRole', { role: 'admin' });

  const user = await Proto.currentUser();

  const object = await Proto.Query('PermField').insert({ user, _rperm: [''], _wperm: [''] });

  const result = await Proto.Query('PermField').findAll();

  expect(result).toHaveLength(1);
  expect(result[0].id).toEqual(object.id);

  const updated = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated?.id).toEqual(object.id);

  await Proto.logout();

  const result2 = await Proto.Query('PermField').findAll();
  expect(result2).toHaveLength(0);

  const updated2 = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated2?.id).toBeUndefined();

  await expect(() => object.save()).rejects.toThrow();
})

test('test permission field 2', async () => {

  await Proto.run('createUserWithRole', { role: 'admin' });

  const user = await Proto.currentUser();

  const object = await Proto.Query('PermField').insert({ users: [user], _rperm: [''], _wperm: [''] });

  const result = await Proto.Query('PermField').findAll();

  expect(result).toHaveLength(1);
  expect(result[0].id).toEqual(object.id);

  const updated = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated?.id).toEqual(object.id);

  await Proto.logout();

  const result2 = await Proto.Query('PermField').findAll();
  expect(result2).toHaveLength(0);

  const updated2 = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated2?.id).toBeUndefined();

  await expect(() => object.save()).rejects.toThrow();
})

test('test permission field 3', async () => {

  await Proto.run('createUserWithRole', { role: 'admin' });

  const roles = await Proto.run('_currentRoles');

  const object = await Proto.Query('PermField').insert({ role: _.first(roles), _rperm: [''], _wperm: [''] });

  const result = await Proto.Query('PermField').findAll();

  expect(result).toHaveLength(1);
  expect(result[0].id).toEqual(object.id);

  const updated = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated?.id).toEqual(object.id);

  await Proto.logout();

  const result2 = await Proto.Query('PermField').findAll();
  expect(result2).toHaveLength(0);

  const updated2 = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated2?.id).toBeUndefined();

  await expect(() => object.save()).rejects.toThrow();
})

test('test permission field 4', async () => {

  await Proto.run('createUserWithRole', { role: 'admin' });

  const roles = await Proto.run('_currentRoles');

  const object = await Proto.Query('PermField').insert({ roles, _rperm: [''], _wperm: [''] });

  const result = await Proto.Query('PermField').findAll();

  expect(result).toHaveLength(1);
  expect(result[0].id).toEqual(object.id);

  const updated = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated?.id).toEqual(object.id);

  await Proto.logout();

  const result2 = await Proto.Query('PermField').findAll();
  expect(result2).toHaveLength(0);

  const updated2 = await Proto.Query('PermField').equalTo('_id', object.id).updateOne({});
  expect(updated2?.id).toBeUndefined();

  await expect(() => object.save()).rejects.toThrow();
})
