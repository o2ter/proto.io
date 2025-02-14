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
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  socketEndpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test live query', async () => {

  const sub = Proto.Query('Test').subscribe();

  const result = new Promise<string>(res => {
    const { remove } = sub.on('create', (obj) => {
      res(obj.objectId!);
      remove();
    });
  });

  await new Promise(res => setTimeout(res, 100));

  const obj = Proto.Object('Test');
  await obj.save();

  expect(await result).toEqual(obj.objectId);
})
