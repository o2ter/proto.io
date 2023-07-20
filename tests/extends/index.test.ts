//
//  index.test.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2023 O2ter Limited. All rights reserved.
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

import { test, expect } from '@jest/globals';
import Proto from '../../src/client';
import _extends from './extends';
import { IOUser } from '../../src/types/object/user';

const proto = new Proto({
  endpoint: 'http://localhost:8080',
  classExtends: _extends,
});

test('test types', async () => {

  const user = proto.object('_User');

  expect(user).toBeInstanceOf(IOUser);

});

test('test methods', async () => {

  const user = proto.object('_User');

  expect(await user.softDelete()).toStrictEqual('deleted');

});

test('test property', async () => {

  const user = proto.object('_User');

  user.name = 'test';
  expect(user.name).toStrictEqual('test');
});