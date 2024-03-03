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
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import Decimal from 'decimal.js';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('echo', async () => {
  const result = await Proto.run('echo', 'hello, world');
  expect(result).toStrictEqual('hello, world');
});

test('echoMaster', async () => {
  await expect(() => Proto.run('echoMaster', 'hello, world')).rejects.toThrow('No permission');
  const result = await Proto.run('echoMaster', 'hello, world', { master: true });
  expect(result).toStrictEqual('hello, world');
});

test('test codec', async () => {

  const obj = {
    hello: 'world',
    $array: [1, 2, null, { string: '' }],
    decimal: new Decimal('10.05'),
    date: new Date(),
  };

  const result = await Proto.run('echo', obj);
  expect(result).toStrictEqual(obj);
});

test('test schema', async () => {
  const result = await Proto.schema({ master: true });
  expect(result.User).toBeTruthy();
});

test('test session id', async () => {
  const sessionId = await Proto.run('sessionId');
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
  expect(await Proto.run('sessionId')).toStrictEqual(sessionId);
});

test('test user', async () => {

  await expect(() => Proto.run('echoUser', 'hello, world')).rejects.toThrow('No permission');

  await Proto.run('createUser');

  const user = await Proto.currentUser();
  expect(user?.objectId).toBeTruthy();

  const result = await Proto.run('echoUser', 'hello, world');
  expect(result).toStrictEqual('hello, world');

  await Proto.logout();

  const user2 = await Proto.currentUser();
  expect(user2?.objectId).toBeUndefined();

  await expect(() => Proto.run('echoUser', 'hello, world')).rejects.toThrow('No permission');

});

test('test config', async () => {
  const date = new Date;
  const values = {
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
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  };

  await Proto.setConfig(values, { master: true });
  const config = await Proto.config();

  expect(config).toStrictEqual(values);

  await Proto.setConfig({ number: 12 }, { master: true });
  const config2 = await Proto.config();

  expect(config2.number).toStrictEqual(12);

  await Proto.setConfig({ number: null, decimal: null }, { master: true });
  const config3 = await Proto.config();

  expect(config3.number).toBeUndefined();
  expect(config3.decimal).toBeUndefined();
});