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
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  socketEndpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test event', async () => {

  const { string } = await Proto.run('testEvent') as any;

  expect(string).toStrictEqual('test');
})

test('test event 2', async () => {

  const result = new Promise<any>(res => {
    const { remove } = Proto.listen(({ string }) => {
      res(string);
      remove();
    });
  });

  await new Promise(res => setTimeout(res, 100));

  await Proto.notify({ string: 'test' });

  expect(await result).toStrictEqual('test');
})

test('test event 3', async () => {

  const result = new Promise<any>(res => {
    const { remove } = Proto.listen(({ string }) => {
      res(string);
      remove();
    }, {
      number: { $gt: 5 }
    });
  });

  await new Promise(res => setTimeout(res, 100));

  await Proto.notify({ string: 'test' });
  await Proto.notify({ string: 'test2', number: 2 });
  await Proto.notify({ string: 'test3', number: 3 });
  await Proto.notify({ string: 'test4', number: 4 });
  await Proto.notify({ string: 'test5', number: 5 });
  await Proto.notify({ string: 'test6', number: 6 });

  expect(await result).toStrictEqual('test6');
})
