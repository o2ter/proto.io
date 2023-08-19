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

import { TObject, serialize, deserialize, Decimal } from '../../src/internals';
import { expect, test } from '@jest/globals';

test('test serialize', async () => {

  const result = serialize({
    $x: 0,
    y: new Decimal('10.05'),
  });

  expect(result).toStrictEqual('{"$$x":0,"y":{"$decimal":"10.05"}}');

});

test('test deserialize', async () => {

  const result = deserialize('{"$$x":0,"y":{"$decimal":"10.05"}}');

  expect(result).toStrictEqual({
    $x: 0,
    y: new Decimal('10.05'),
  });
  
});

test('test keywords', async () => {

  const obj = {
    $ref: 0,
    $object: {},
  };

  const result = deserialize(serialize(obj));

  expect(result).toStrictEqual(obj);

});

test('test recursive', async () => {

  const obj: any = {};
  obj.self = obj;

  const result: any = deserialize(serialize(obj));

  expect(result.self).toBe(result);

});

test('test array recursive', async () => {

  const array: any[] = [];
  array[0] = { self: array };

  const result: any = deserialize(serialize(array));

  expect(result[0].self).toBe(result);

});

test('test object recursive', async () => {

  const obj = new TObject('test', (self) => ({ self }));

  const result: any = deserialize(serialize(obj));

  expect(result.get('self') instanceof TObject).toBeTruthy();
  expect(result.get('self')).toBe(result);

});
