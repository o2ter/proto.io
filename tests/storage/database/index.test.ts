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
import fs from 'fs';
import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../../src/client/proto';
import { generateString, streamToBuffer } from '../utils';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test files', async () => {
  const file = Proto.File('test.txt', 'hello, world', 'text/plain');
  await file.save({ uploadToken: await Proto.run('generateUploadToken') as string });

  const data = await streamToBuffer(file.fileData());
  expect(data.toString('utf8')).toStrictEqual('hello, world');
});
test('test files 2', async () => {
  const file = Proto.File('test.txt', fs.createReadStream(__filename), 'text/plain');
  await file.save({ uploadToken: await Proto.run('generateUploadToken') as string });

  const data = await streamToBuffer(file.fileData());
  expect(data.toString('utf8')).toStrictEqual(fs.readFileSync(__filename, { encoding: 'utf8' }));
});
test('test files 3', async () => {
  const content = generateString(128 * 1024);
  const file = Proto.File('test.txt', content, 'text/plain');
  await file.save({ uploadToken: await Proto.run('generateUploadToken') as string });

  const data = await streamToBuffer(file.fileData());
  expect(data.toString('utf8')).toStrictEqual(content);
});

test('test uploadToken', async () => {
  const file = Proto.File('test.txt', 'hello, world', 'text/plain');
  await expect(() => file.save()).rejects.toThrow('Upload token is required');
});
