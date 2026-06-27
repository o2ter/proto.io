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

test('test create required', async () => {

  const inserted = await Proto.Query('Test').insert({
    required: 'required',
  });
  expect(inserted.get('required')).toBe('required');

  await expect(() => Proto.Query('Test').insert({
    required: undefined,
  })).rejects.toThrow('Field "required" is required');
});

test('test create required 2', async () => {

  const inserted = await Proto.Query('Test').insert({
    'shape.required': 'required',
  });
  expect(inserted.get('shape.required')).toBe('required');

  await expect(() => Proto.Query('Test').insert({
    'shape.required': undefined,
  })).rejects.toThrow('Field "shape.required" is required');
});

test('test update required', async () => {

  const inserted = await Proto.Query('Test').insert({
    required: 'required',
  });
  
  const updated = await Proto.Query('Test').equalTo('_id', inserted.id!).updateOne({
    required: {
      $set: 'required2',
    }
  });
  expect(updated?.get('required')).toBe('required2');

  await expect(() => Proto.Query('Test').equalTo('_id', inserted.id!).updateOne({
    required: {
      $set: undefined,
    }
  })).rejects.toThrow('Field "required" is required');
});

test('test update required 2', async () => {

  const inserted = await Proto.Query('Test').insert({
    'shape.required': 'required',
  });
  
  const updated = await Proto.Query('Test').equalTo('_id', inserted.id!).updateOne({
    'shape.required': {
      $set: 'required2',
    }
  });
  expect(updated?.get('shape.required')).toBe('required2');

  await expect(() => Proto.Query('Test').equalTo('_id', inserted.id!).updateOne({
    'shape.required': {
      $set: undefined,
    }
  })).rejects.toThrow('Field "shape.required" is required');
});

test('test upsert required', async () => {

  const inserted = await Proto.Query('Test').equalTo('_id', 'not_valid_id').upsertOne(
    {
      required: {
        $set: 'not_valid',
      }
    },
    {
      required: 'required',
    }
  );
  expect(inserted.get('required')).toBe('required');

  const upserted = await Proto.Query('Test').equalTo('_id', inserted.id!).upsertOne(
    {
      required: {
        $set: 'required2',
      }
    },
    {
      required: 'not_valid',
    }
  );
  expect(upserted?.get('required')).toBe('required2');

  await expect(() => Proto.Query('Test').equalTo('_id', 'not_valid_id').upsertOne(
    {
      required: {
        $set: 'not_valid',
      }
    },
    {
      required: undefined,
    }
  )).rejects.toThrow('Field "required" is required');

  await expect(() => Proto.Query('Test').equalTo('_id', inserted.id!).upsertOne(
    {
      required: {
        $set: undefined,
      }
    },
    {
      required: 'not_valid',
    }
  )).rejects.toThrow('Field "required" is required');
});

test('test upsert required 2', async () => {

  const inserted = await Proto.Query('Test').equalTo('_id', 'not_valid_id').upsertOne(
    {
      'shape.required': {
        $set: 'not_valid',
      }
    },
    {
      'shape.required': 'required',
    }
  );
  expect(inserted.get('shape.required')).toBe('required');

  const upserted = await Proto.Query('Test').equalTo('_id', inserted.id!).upsertOne(
    {
      'shape.required': {
        $set: 'required2',
      }
    },
    {
      'shape.required': 'not_valid',
    }
  );
  expect(upserted?.get('shape.required')).toBe('required2');

  await expect(() => Proto.Query('Test').equalTo('_id', 'not_valid_id').upsertOne(
    {
      'shape.required': {
        $set: 'not_valid',
      }
    },
    {
      'shape.required': undefined,
    }
  )).rejects.toThrow('Field "shape.required" is required');

  await expect(() => Proto.Query('Test').equalTo('_id', inserted.id!).upsertOne(
    {
      'shape.required': {
        $set: undefined,
      }
    },
    {
      'shape.required': 'not_valid',
    }
  )).rejects.toThrow('Field "shape.required" is required');

});
