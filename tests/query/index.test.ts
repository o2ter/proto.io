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

test('test count', async () => {
  await Proto.Query('Test').insert({});
  const count = await Proto.Query('Test').count();
  expect(count).toBeGreaterThan(0);
})

test('test field name', async () => {
  const inserted = await Proto.Query('Test').insert({ 'test_field-name': 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('test_field-name')).toStrictEqual('hello');
})

test('test insert', async () => {
  const inserted = await Proto.Query('Test').insert({ string: 'hello', 'shape.string': 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('shape.string')).toStrictEqual('hello');
})

test('test insert 2', async () => {
  const obj = Proto.Object('Test');
  obj.set('string', 'hello');
  obj.set('shape.string', 'hello');

  await obj.save();

  expect(obj.objectId).toBeTruthy();
  expect(obj.get('string')).toStrictEqual('hello');
  expect(obj.get('shape.string')).toStrictEqual('hello');
})

test('test insert many', async () => {
  const count = await Proto.Query('Test').insertMany([
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
    { string: 'insertMany', 'shape.string': 'insertMany' },
  ]);
  expect(count).toStrictEqual(4);

  const result = await Proto.Query('Test').equalTo('string', 'insertMany').find();
  expect(result.length).toStrictEqual(4);

  for (const item of result) {
    expect(item.get('string')).toStrictEqual('insertMany');
    expect(item.get('shape.string')).toStrictEqual('insertMany');
  }
})

test('test destroy', async () => {
  const inserted = await Proto.Query('Test').insert({ string: 'destroy' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('destroy');
  await inserted.destroy();
  const result = await Proto.Query('Test').equalTo('string', 'destroy').find();
  expect(result).toStrictEqual([]);
})

test('test each batch', async () => {
  const count = await Proto.Query('Test').insertMany([
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
    { string: 'eachBatch' },
  ]);
  expect(count).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch').eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.objectId).length).toStrictEqual(5);
  expect(counter).toStrictEqual(3);
})

test('test each batch 2', async () => {
  const count = await Proto.Query('Test').insertMany([
    { string: 'eachBatch2', number: 1 },
    { string: 'eachBatch2', number: 2 },
    { string: 'eachBatch2', number: 3 },
    { string: 'eachBatch2', number: 4 },
    { string: 'eachBatch2', number: 5 },
  ]);
  expect(count).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch2').sort({ number: 1 }).eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.objectId).length).toStrictEqual(5);
  expect(_.map(result, x => x.get('number'))).toStrictEqual([1, 2, 3, 4, 5]);
  expect(counter).toStrictEqual(3);
})

test('test each batch 3', async () => {
  const count = await Proto.Query('Test').insertMany([
    { string: 'eachBatch3', number: 1 },
    { string: 'eachBatch3', number: 2 },
    { string: 'eachBatch3', number: 3 },
    { string: 'eachBatch3', number: 4 },
    { string: 'eachBatch3', number: 5 },
  ]);
  expect(count).toStrictEqual(5);

  const result: any[] = [];
  let counter = 0;
  await Proto.Query('Test').equalTo('string', 'eachBatch3').sort({ _created_at: 1 }).eachBatch((batch) => {
    result.push(...batch);
    counter += 1;
  }, { batchSize: 2 });

  expect(result.length).toStrictEqual(5);
  expect(_.uniqBy(result, x => x.objectId).length).toStrictEqual(5);
  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
  expect(counter).toStrictEqual(3);
})

test('test types', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    shape: {
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
    },
  });
  expect(inserted.get('boolean')).toStrictEqual(true);
  expect(inserted.get('number')).toStrictEqual(42.5);
  expect(inserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('date')).toStrictEqual(date);
  expect(inserted.get('shape.boolean')).toStrictEqual(true);
  expect(inserted.get('shape.number')).toStrictEqual(42.5);
  expect(inserted.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('shape.string')).toStrictEqual('hello');
  expect(inserted.get('shape.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('default', 42).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.default', 42).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('null_boolean', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_number', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_decimal', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_string', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('null_date', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.null_boolean', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_number', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_decimal', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_string', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_date', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('null_boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('null_date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('shape.null_boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('number', [1, 2, 3, 42.5]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.0', [1, 2, 3, 42.5, 'hello']).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('shape.number', [1, 2, 3, 42.5]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('shape.array.0', [1, 2, 3, 42.5, 'hello']).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('null_string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('shape.string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('shape.string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('shape.string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('shape.string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('shape.string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('shape.null_string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('shape.null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('default', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.default', 42).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('null_boolean', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_number', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_decimal', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_string', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_date', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.null_boolean', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.null_number', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.null_decimal', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.null_string', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.null_date', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('null_boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('shape.null_boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.null_number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.null_decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.null_string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.null_date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('number', [1, 2, 3, 42.5]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.number', [1, 2, 3, 42.5]).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('shape.boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('null_string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('null_array').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('shape.string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('shape.string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('shape.string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('shape.string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('shape.string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('shape.null_string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('shape.null_array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    array: [1, 2, 3, date, new Decimal('0.001')],
    shape: {
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
  });
  expect(inserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
  expect(inserted.get('shape.array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('array.0', 1).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.1', 2).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.2', 3).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.3', date).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('array.4', new Decimal('0.001')).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.array.0', 1).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.1', 2).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.2', 3).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.3', date).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.4', new Decimal('0.001')).first())?.objectId).toBeUndefined();

  expect((await q.clone().every('array', q => q.notEqualTo('$', 3)).first())?.objectId).toBeUndefined();
  expect((await q.clone().some('array', q => q.equalTo('$', null)).first())?.objectId).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.notEqualTo('$', 3)).first())?.objectId).toBeUndefined();
  expect((await q.clone().some('shape.array', q => q.equalTo('$', null)).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();

  expect((await q.clone().notContainsIn('shape.array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('shape.array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('shape.array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('shape.array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();
  expect((await q.clone().notContainsIn('shape.array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSubset('array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSubset('array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isDisjoint('array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSuperset('array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isIntersect('array', [4, 5, 6]).first())?.objectId).toBeUndefined();

  expect((await q.clone().isSubset('shape.array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSubset('shape.array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isDisjoint('shape.array', [1, 2, 3]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isSuperset('shape.array', [4, 5, 6]).first())?.objectId).toBeUndefined();
  expect((await q.clone().isIntersect('shape.array', [4, 5, 6]).first())?.objectId).toBeUndefined();

  expect((await q.clone().containsIn('array.0', [1, 2, 3, 42.5, 'hello']).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.array.0', [1, 2, 3, 42.5, 'hello']).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('array.0', 4).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.1', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.2', 6).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.3', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.4', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('shape.array.0', 4).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.array.1', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.array.2', 6).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.array.3', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.array.4', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('array', q => q.equalTo('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.notEqualTo('$', null)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.array', q => q.equalTo('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.array', q => q.notEqualTo('$', null)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('shape.array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('shape.array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().isSubset('array', [1, 2, 3, 4, 5, 6, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isDisjoint('array', [4, 5, 6]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isSuperset('array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isIntersect('array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('array').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().isSubset('shape.array', [1, 2, 3, 4, 5, 6, date, new Decimal('0.001')]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isDisjoint('shape.array', [4, 5, 6]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isSuperset('shape.array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().isIntersect('shape.array', [1, 2, 3]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('shape.array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 3', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    object: {
      boolean: true,
      number: 42.5,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
    shape: {
      object: {
        boolean: true,
        number: 42.5,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
        array: [1, 2, 3, date, new Decimal('0.001')],
      },
    },
  });
  expect(inserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  expect(inserted.get('shape.object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    array: [1, 2, 3, date, new Decimal('0.001')],
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('object.null', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('object.null', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('shape.object.null', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('object.boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('object.date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.object.boolean', true).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.number', 42.5).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.string', 'hello').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.date', date).first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('object.string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('object.string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('object.string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_string').first())?.objectId).toBeUndefined();

  expect((await q.clone().endsWith('shape.object.string', 'hel').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('shape.object.string', 'llo').first())?.objectId).toBeUndefined();
  expect((await q.clone().startsWith('shape.object.string', 'ii').first())?.objectId).toBeUndefined();
  expect((await q.clone().size('shape.object.string', 4).first())?.objectId).toBeUndefined();
  expect((await q.clone().empty('shape.object.string').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('shape.object.null_string').first())?.objectId).toBeUndefined();

  expect((await q.clone().empty('object.array').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().empty('shape.object.array').first())?.objectId).toBeUndefined();
  expect((await q.clone().notEmpty('shape.object.null_array').first())?.objectId).toBeUndefined();

  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.null', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('shape.object.null', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.null', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.null', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.null', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.null', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('object.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.object.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.object.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('shape.object.boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('shape.object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('object.string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('object.string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('object.string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('object.string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('object.string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('object.null_string').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().startsWith('shape.object.string', 'hel').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().endsWith('shape.object.string', 'llo').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().pattern('shape.object.string', 'll').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('shape.object.string', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEmpty('shape.object.string').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('shape.object.null_string').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEmpty('object.array').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('object.null_array').first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEmpty('shape.object.array').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().empty('shape.object.null_array').first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 4', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6]],
    shape: {
      array: [[1, 2, 3], [4, 5, 6]],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().size('array', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().size('shape.array', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().size('array', 2).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.size('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().size('shape.array', 2).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.array', q => q.size('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
    shape: {
      array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6], new Date],
    shape: {
      array: [[1, 2, 3], [4, 5, 6], new Date],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.every('$', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.array', q => q.some('$', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }, new Date],
    shape: {
      array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }, new Date],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.every('array', q => q.equalTo('$', 0))).first())?.objectId).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.array', q => q.some('array', q => q.equalTo('$', 1))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 8', async () => {

  const inserted1 = await Proto.Query('Test').insert({
    string: '',
  });

  const q1 = Proto.Query('Test').equalTo('_id', inserted1.objectId);

  expect((await q1.clone().containsIn('string', ['', null]).first())?.objectId).toStrictEqual(inserted1.objectId);
  expect((await q1.clone().notContainsIn('string', ['', null]).first())?.objectId).toBeUndefined();

  const inserted2 = await Proto.Query('Test').insert({
    string: null,
  });

  const q2 = Proto.Query('Test').equalTo('_id', inserted2.objectId);

  expect((await q2.clone().containsIn('string', ['', null]).first())?.objectId).toStrictEqual(inserted2.objectId);
  expect((await q2.clone().notContainsIn('string', ['', null]).first())?.objectId).toBeUndefined();

  const inserted3 = await Proto.Query('Test').insert({
    string: 'test',
  });

  const q3 = Proto.Query('Test').equalTo('_id', inserted3.objectId);

  expect((await q3.clone().containsIn('string', ['', null]).first())?.objectId).toBeUndefined();
  expect((await q3.clone().notContainsIn('string', ['', null]).first())?.objectId).toStrictEqual(inserted3.objectId);
})

test('test update types', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    shape: {
      boolean: true,
      number: 42.5,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ boolean: { $set: false } }))?.get('boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ number: { $set: 64 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $set: new Decimal('0.002') } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ string: { $set: 'world' } }))?.get('string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ date: { $set: date2 } }))?.get('date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ number: { $inc: 2 } }))?.get('number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ decimal: { $inc: 1 } }))?.get('decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ number: { $dec: 2 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $dec: 1 } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ number: { $mul: 2 } }))?.get('number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ decimal: { $mul: 2 } }))?.get('decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ number: { $div: 2 } }))?.get('number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ decimal: { $div: 2 } }))?.get('decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ number: { $min: 2 } }))?.get('number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ decimal: { $min: 0 } }))?.get('decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ date: { $min: date } }))?.get('date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ number: { $max: 10 } }))?.get('number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ decimal: { $max: 10 } }))?.get('decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ date: { $max: date2 } }))?.get('date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.boolean': { $set: false } }))?.get('shape.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'shape.number': { $set: 64 } }))?.get('shape.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.decimal': { $set: new Decimal('0.002') } }))?.get('shape.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'shape.string': { $set: 'world' } }))?.get('shape.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'shape.date': { $set: date2 } }))?.get('shape.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.number': { $inc: 2 } }))?.get('shape.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'shape.decimal': { $inc: 1 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'shape.number': { $dec: 2 } }))?.get('shape.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.decimal': { $dec: 1 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.number': { $mul: 2 } }))?.get('shape.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'shape.decimal': { $mul: 2 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'shape.number': { $div: 2 } }))?.get('shape.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.decimal': { $div: 2 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.number': { $min: 2 } }))?.get('shape.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'shape.decimal': { $min: 0 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'shape.date': { $min: date } }))?.get('shape.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'shape.number': { $max: 10 } }))?.get('shape.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'shape.decimal': { $max: 10 } }))?.get('shape.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'shape.date': { $max: date2 } }))?.get('shape.date')).toStrictEqual(date2);
})

test('test update types 2', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    object: {
      boolean: true,
      number: 42.5,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    shape: {
      object: {
        boolean: true,
        number: 42.5,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      },
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'object.boolean': { $set: false } }))?.get('object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'object.number': { $set: 64 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $set: new Decimal('0.002') } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'object.string': { $set: 'world' } }))?.get('object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'object.date': { $set: date2 } }))?.get('object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'object.number': { $inc: 2 } }))?.get('object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'object.decimal': { $inc: 1 } }))?.get('object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'object.number': { $dec: 2 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $dec: 1 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'object.number': { $mul: 2 } }))?.get('object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'object.decimal': { $mul: 2 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'object.number': { $div: 2 } }))?.get('object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'object.decimal': { $div: 2 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'object.number': { $min: 2 } }))?.get('object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'object.decimal': { $min: 0 } }))?.get('object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'object.date': { $min: date } }))?.get('object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'object.number': { $max: 10 } }))?.get('object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'object.decimal': { $max: 10 } }))?.get('object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'object.date': { $max: date2 } }))?.get('object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.object.boolean': { $set: false } }))?.get('shape.object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'shape.object.number': { $set: 64 } }))?.get('shape.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $set: new Decimal('0.002') } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'shape.object.string': { $set: 'world' } }))?.get('shape.object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'shape.object.date': { $set: date2 } }))?.get('shape.object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.object.number': { $inc: 2 } }))?.get('shape.object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $inc: 1 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'shape.object.number': { $dec: 2 } }))?.get('shape.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $dec: 1 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.object.number': { $mul: 2 } }))?.get('shape.object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $mul: 2 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'shape.object.number': { $div: 2 } }))?.get('shape.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $div: 2 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.object.number': { $min: 2 } }))?.get('shape.object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $min: 0 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'shape.object.date': { $min: date } }))?.get('shape.object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'shape.object.number': { $max: 10 } }))?.get('shape.object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'shape.object.decimal': { $max: 10 } }))?.get('shape.object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'shape.object.date': { $max: date2 } }))?.get('shape.object.date')).toStrictEqual(date2);
})

test('test update types 3', async () => {
  const date = new Date;
  const date2 = new Date;
  const inserted = await Proto.Query('Test').insert({
    array: [{
      object: {
        boolean: true,
        number: 42.5,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      },
    }],
    shape: {
      array: [{
        object: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        },
      }],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'array.0.object.boolean': { $set: false } }))?.get('array.0.object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'array.0.object.number': { $set: 64 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $set: new Decimal('0.002') } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'array.0.object.string': { $set: 'world' } }))?.get('array.0.object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'array.0.object.date': { $set: date2 } }))?.get('array.0.object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'array.0.object.number': { $inc: 2 } }))?.get('array.0.object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $inc: 1 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $dec: 2 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $dec: 1 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $mul: 2 } }))?.get('array.0.object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $mul: 2 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $div: 2 } }))?.get('array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $div: 2 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'array.0.object.number': { $min: 2 } }))?.get('array.0.object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $min: 0 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'array.0.object.date': { $min: date } }))?.get('array.0.object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'array.0.object.number': { $max: 10 } }))?.get('array.0.object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'array.0.object.decimal': { $max: 10 } }))?.get('array.0.object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'array.0.object.date': { $max: date2 } }))?.get('array.0.object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.array.0.object.boolean': { $set: false } }))?.get('shape.array.0.object.boolean')).toStrictEqual(false);
  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $set: 64 } }))?.get('shape.array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $set: new Decimal('0.002') } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));
  expect((await q.clone().updateOne({ 'shape.array.0.object.string': { $set: 'world' } }))?.get('shape.array.0.object.string')).toStrictEqual('world');
  expect((await q.clone().updateOne({ 'shape.array.0.object.date': { $set: date2 } }))?.get('shape.array.0.object.date')).toStrictEqual(date2);

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $inc: 2 } }))?.get('shape.array.0.object.number')).toStrictEqual(66);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $inc: 1 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('1.002'));

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $dec: 2 } }))?.get('shape.array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $dec: 1 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $mul: 2 } }))?.get('shape.array.0.object.number')).toStrictEqual(128);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $mul: 2 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('0.004'));

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $div: 2 } }))?.get('shape.array.0.object.number')).toStrictEqual(64);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $div: 2 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('0.002'));

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $min: 2 } }))?.get('shape.array.0.object.number')).toStrictEqual(2);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $min: 0 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('0'));
  expect((await q.clone().updateOne({ 'shape.array.0.object.date': { $min: date } }))?.get('shape.array.0.object.date')).toStrictEqual(date);

  expect((await q.clone().updateOne({ 'shape.array.0.object.number': { $max: 10 } }))?.get('shape.array.0.object.number')).toStrictEqual(10);
  expect((await q.clone().updateOne({ 'shape.array.0.object.decimal': { $max: 10 } }))?.get('shape.array.0.object.decimal')).toStrictEqual(new Decimal('10'));
  expect((await q.clone().updateOne({ 'shape.array.0.object.date': { $max: date2 } }))?.get('shape.array.0.object.date')).toStrictEqual(date2);
})

test('test update types 4', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [1, 2, 3],
    shape: {
      array: [1, 2, 3],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ array: { $addToSet: [2, 3, 4] } }))?.get('array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ array: { $push: [4, 5] } }))?.get('array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ array: { $removeAll: [4] } }))?.get('array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ array: { $popFirst: 1 } }))?.get('array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ array: { $popLast: 1 } }))?.get('array')).toStrictEqual([2, 3]);

  expect((await q.clone().updateOne({ 'shape.array': { $addToSet: [2, 3, 4] } }))?.get('shape.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'shape.array': { $push: [4, 5] } }))?.get('shape.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'shape.array': { $removeAll: [4] } }))?.get('shape.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.array': { $popFirst: 1 } }))?.get('shape.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.array': { $popLast: 1 } }))?.get('shape.array')).toStrictEqual([2, 3]);
})

test('test update types 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    object: {
      array: [1, 2, 3],
    },
    shape: {
      object: {
        array: [1, 2, 3],
      },
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'object.array': { $addToSet: [2, 3, 4] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'object.array': { $push: [4, 5] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $removeAll: [4] } }))?.get('object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $popFirst: 1 } }))?.get('object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'object.array': { $popLast: 1 } }))?.get('object.array')).toStrictEqual([2, 3]);

  expect((await q.clone().updateOne({ 'shape.object.array': { $addToSet: [2, 3, 4] } }))?.get('shape.object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'shape.object.array': { $push: [4, 5] } }))?.get('shape.object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'shape.object.array': { $removeAll: [4] } }))?.get('shape.object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.object.array': { $popFirst: 1 } }))?.get('shape.object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.object.array': { $popLast: 1 } }))?.get('shape.object.array')).toStrictEqual([2, 3]);
})

test('test update types 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{
      object: {
        array: [1, 2, 3],
      },
    }],
    shape: {
      array: [{
        object: {
          array: [1, 2, 3],
        },
      }],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ 'array.0.object.array': { $addToSet: [2, 3, 4] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $push: [4, 5] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $removeAll: [4] } }))?.get('array.0.object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $popFirst: 1 } }))?.get('array.0.object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'array.0.object.array': { $popLast: 1 } }))?.get('array.0.object.array')).toStrictEqual([2, 3]);

  expect((await q.clone().updateOne({ 'shape.array.0.object.array': { $addToSet: [2, 3, 4] } }))?.get('shape.array.0.object.array')).toStrictEqual([1, 2, 3, 4]);
  expect((await q.clone().updateOne({ 'shape.array.0.object.array': { $push: [4, 5] } }))?.get('shape.array.0.object.array')).toStrictEqual([1, 2, 3, 4, 4, 5]);
  expect((await q.clone().updateOne({ 'shape.array.0.object.array': { $removeAll: [4] } }))?.get('shape.array.0.object.array')).toStrictEqual([1, 2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.array.0.object.array': { $popFirst: 1 } }))?.get('shape.array.0.object.array')).toStrictEqual([2, 3, 5]);
  expect((await q.clone().updateOne({ 'shape.array.0.object.array': { $popLast: 1 } }))?.get('shape.array.0.object.array')).toStrictEqual([2, 3]);
})

test('test update types 7', async () => {
  const obj1 = await Proto.Query('Test').insert({});
  const obj2 = await Proto.Query('Test').insert({});
  const obj3 = await Proto.Query('Test').insert({});
  const obj4 = await Proto.Query('Test').insert({});
  const obj5 = await Proto.Query('Test').insert({});
  const inserted = await Proto.Query('Test').insert({
    relation: [obj1, obj2, obj3],
    shape: {
      relation: [obj1, obj2, obj3],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation', 'shape');

  expect((await q.clone().updateOne({ relation: { $addToSet: [obj2, obj3, obj4] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ relation: { $push: [obj4, obj5] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4, obj5].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ relation: { $removeAll: [obj4] } }))?.get('relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj5].map(x => x.objectId).sort());

  expect((await q.clone().updateOne({ 'shape.relation': { $addToSet: [obj2, obj3, obj4] } }))?.get('shape.relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ 'shape.relation': { $push: [obj4, obj5] } }))?.get('shape.relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj4, obj5].map(x => x.objectId).sort());
  expect((await q.clone().updateOne({ 'shape.relation': { $removeAll: [obj4] } }))?.get('shape.relation').map((x: any) => x.objectId).sort()).toStrictEqual([obj1, obj2, obj3, obj5].map(x => x.objectId).sort());
})

test('test update types 8', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    object: {
      boolean: true,
      number: 42.5,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      array: [1, 2, 3, date, new Decimal('0.001')],
    },
    shape: {
      object: {
        boolean: true,
        number: 42.5,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
        array: [1, 2, 3, date, new Decimal('0.001')],
      },
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().updateOne({ boolean: { $set: null } }))?.get('boolean')).toStrictEqual(null);
  expect((await q.clone().updateOne({ number: { $set: null } }))?.get('number')).toStrictEqual(null);
  expect((await q.clone().updateOne({ decimal: { $set: null } }))?.get('decimal')).toStrictEqual(null);
  expect((await q.clone().updateOne({ string: { $set: null } }))?.get('string')).toStrictEqual(null);
  expect((await q.clone().updateOne({ date: { $set: null } }))?.get('date')).toStrictEqual(null);
  expect((await q.clone().updateOne({ array: { $set: null } }))?.get('array')).toStrictEqual(null);

  expect((await q.clone().updateOne({ 'shape.boolean': { $set: null } }))?.get('shape.boolean')).toBeUndefined();
  expect((await q.clone().updateOne({ 'shape.number': { $set: null } }))?.get('shape.number')).toBeUndefined();
  expect((await q.clone().updateOne({ 'shape.decimal': { $set: null } }))?.get('shape.decimal')).toBeUndefined();
  expect((await q.clone().updateOne({ 'shape.string': { $set: null } }))?.get('shape.string')).toBeUndefined();
  expect((await q.clone().updateOne({ 'shape.date': { $set: null } }))?.get('shape.date')).toBeUndefined();
  expect((await q.clone().updateOne({ 'shape.array': { $set: null } }))?.get('shape.array')).toBeUndefined();
})

test('test save keys', async () => {
  const inserted = await Proto.Query('Test').insert({});

  const obj = Proto.Object('Test');
  obj.set('pointer', inserted);
  obj.set('shape', { pointer: inserted });
  await obj.save();

  expect(obj.get('pointer')?.objectId).toStrictEqual(inserted.objectId);
  expect(obj.get('shape.pointer')?.objectId).toStrictEqual(inserted.objectId);
})

test('test save keys 2', async () => {
  const inserted = await Proto.Query('Test').insert({});

  const obj = Proto.Object('Test');
  obj.set('relation', [inserted]);
  obj.set('shape', { relation: [inserted] });
  await obj.save();

  expect(obj.get('relation')?.[0]?.objectId).toStrictEqual(inserted.objectId);
  expect(obj.get('shape.relation')?.[0]?.objectId).toStrictEqual(inserted.objectId);
})

test('test save keys 3', async () => {
  const obj = await Proto.Query('Test').insert({});
  obj.set('shape', { 
    number: 42,
    string: 'hello',
  });
  await obj.save();

  expect(obj.get('shape.number')).toStrictEqual(42);
  expect(obj.get('shape.string')).toStrictEqual('hello');
})

test('test pointer', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('pointer', 'pointer2', 'shape.pointer', 'shape.pointer2')
    .updateOne({
      pointer: { $set: inserted },
      pointer2: { $set: inserted },
      'shape.pointer': { $set: inserted },
      'shape.pointer2': { $set: inserted },
    });

  expect(updated?.get('pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer.number')).toStrictEqual(42.5);
  expect(updated?.get('pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer.string')).toStrictEqual('hello');
  expect(updated?.get('pointer.date')).toStrictEqual(date);

  expect(updated?.get('pointer2.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer2.number')).toStrictEqual(42.5);
  expect(updated?.get('pointer2.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer2.string')).toStrictEqual('hello');
  expect(updated?.get('pointer2.date')).toStrictEqual(date);

  expect(updated?.get('shape.pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.pointer.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.pointer.string')).toStrictEqual('hello');
  expect(updated?.get('shape.pointer.date')).toStrictEqual(date);

  expect(updated?.get('shape.pointer2.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.pointer2.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.pointer2.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.pointer2.string')).toStrictEqual('hello');
  expect(updated?.get('shape.pointer2.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('pointer');

  expect((await q.clone().equalTo('pointer', inserted).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.pointer', inserted).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer.date', date).first())?.objectId).toStrictEqual(inserted.objectId);
})

test('test pointer 2', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    pointer: invalid,
    shape: {
      pointer: invalid,
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('pointer');

  expect((await q.clone().equalTo('pointer', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.pointer', null).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('*', 'relation', 'shape.relation')
    .updateOne({
      relation: { $set: [inserted] },
      'shape.relation': { $set: [inserted] },
    });

  expect(updated?.get('relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().equalTo('relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation2', 'shape.relation2')
    .updateOne({
      pointer: { $set: inserted },
      'shape.pointer': { $set: inserted },
    });

  expect(updated?.get('relation2').length).toStrictEqual(1);
  expect(updated?.get('relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation2.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation2.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation2').length).toStrictEqual(1);
  expect(updated?.get('shape.relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation2.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation2.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation2');

  expect((await q.clone().equalTo('relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 3', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation3', 'shape.relation3')
    .updateOne({
      relation: { $set: [inserted] },
      'shape.relation': { $set: [inserted] },
    });

  expect(updated?.get('relation3').length).toStrictEqual(1);
  expect(updated?.get('relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation3.0.number')).toStrictEqual(42.5);
  expect(updated?.get('relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation3.0.date')).toStrictEqual(date);

  expect(updated?.get('shape.relation3').length).toStrictEqual(1);
  expect(updated?.get('shape.relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.relation3.0.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('shape.relation3.0.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation3');

  expect((await q.clone().equalTo('relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 4', async () => {
  const invalid = Proto.Object('Test', 'xxxxxxxxxx');
  const inserted = await Proto.Query('Test').insert({
    relation: [invalid],
    shape: {
      relation: [invalid],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation');

  expect((await q.clone().equalTo('relation', []).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('relation', 0).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation', []).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().size('shape.relation', 0).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().equalTo('relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('shape.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('shape.relation.0.relation.0.pointer.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
})

test('test relation 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().some('relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('shape.relation', q => q.equalTo('number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.relation', q => q.equalTo('pointer.number', 42.5)).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    number: 42.5,
  });
  await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      pointer: { $set: inserted },
      relation: { $set: [inserted] },
      'shape.pointer': { $set: inserted },
      'shape.relation': { $set: [inserted] },
    });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().some('relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('shape.relation', q => q.some('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().some('shape.relation', q => q.some('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().every('shape.relation', q => q.every('relation', q => q.equalTo('number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('shape.relation', q => q.every('relation', q => q.equalTo('pointer.number', 42.5))).first())?.objectId).toStrictEqual(inserted.objectId);

}, 60000)

test('test relation query', async () => {

  await Proto.Query('Test').insertMany([
    { string: 'relation query', number: 1 },
    { string: 'relation query', number: 2 },
    { string: 'relation query', number: 3 },
    { string: 'relation query', number: 4 },
  ]);

  const objs = await Proto.Query('Test').equalTo('string', 'relation query').find();

  const inserted = await Proto.Query('Test').insert({
    string: 'relation query',
    relation: objs,
  });

  const result = await Proto.Relation('Test', objs[0], 'relation').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await Proto.Relation('Test', inserted, 'relation').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test relation query 2', async () => {

  await Proto.Query('Test').insertMany([
    { string: 'relation query 2', number: 1 },
    { string: 'relation query 2', number: 2 },
    { string: 'relation query 2', number: 3 },
    { string: 'relation query 2', number: 4 },
  ]);

  const objs = await Proto.Query('Test').equalTo('string', 'relation query 2').find();

  const inserted = await Proto.Query('Test').insert({
    string: 'relation query 2',
    'shape.relation': objs,
  });

  const result = await Proto.Relation('Test', objs[0], 'shape.relation').find();
  expect(result.length).toStrictEqual(0);

  const result2 = await Proto.Relation('Test', inserted, 'shape.relation').find();

  expect(result2.length).toStrictEqual(4);
  expect(_.map(result2, x => x.get('number')).sort()).toStrictEqual([1, 2, 3, 4]);
})

test('test update', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({});
  const updated = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      boolean: { $set: true },
      number: { $set: 42.5 },
      decimal: { $set: new Decimal('0.001') },
      string: { $set: 'hello' },
      date: { $set: date },
      object: {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      array: { $set: [1, 2, 3, date, new Decimal('0.001')] },
      'shape.boolean': { $set: true },
      'shape.number': { $set: 42.5 },
      'shape.decimal': { $set: new Decimal('0.001') },
      'shape.string': { $set: 'hello' },
      'shape.date': { $set: date },
      'shape.object': {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      'shape.array': { $set: [1, 2, 3, date, new Decimal('0.001')] },
    });

  expect(updated?.objectId).toStrictEqual(inserted.objectId);
  expect(updated?.__v).toStrictEqual(1);

  expect(updated?.get('boolean')).toStrictEqual(true);
  expect(updated?.get('number')).toStrictEqual(42.5);
  expect(updated?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('string')).toStrictEqual('hello');
  expect(updated?.get('date')).toStrictEqual(date);
  expect(updated?.get('object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  expect(updated?.get('shape.boolean')).toStrictEqual(true);
  expect(updated?.get('shape.number')).toStrictEqual(42.5);
  expect(updated?.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('shape.string')).toStrictEqual('hello');
  expect(updated?.get('shape.date')).toStrictEqual(date);
  expect(updated?.get('shape.object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('shape.array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert', async () => {
  const date = new Date;
  const upserted = await Proto.Query('Test')
    .equalTo('_id', '')
    .upsertOne({
      string: { $set: 'update' },
      'shape.string': { $set: 'update' },
    }, {
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
      },
      array: [1, 2, 3, date, new Decimal('0.001')],
      shape: {
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
        },
        array: [1, 2, 3, date, new Decimal('0.001')],
      },
    });

  expect(upserted.objectId).toBeTruthy();
  expect(upserted.__v).toStrictEqual(0);

  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42.5);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  expect(upserted.get('shape.boolean')).toStrictEqual(true);
  expect(upserted.get('shape.number')).toStrictEqual(42.5);
  expect(upserted.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('shape.string')).toStrictEqual('hello');
  expect(upserted.get('shape.date')).toStrictEqual(date);
  expect(upserted.get('shape.object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('shape.array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert 2', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({});
  const upserted = await Proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .upsertOne({
      boolean: { $set: true },
      number: { $set: 42.5 },
      decimal: { $set: new Decimal('0.001') },
      string: { $set: 'hello' },
      date: { $set: date },
      object: {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      array: { $set: [1, 2, 3, date, new Decimal('0.001')] },
      'shape.boolean': { $set: true },
      'shape.number': { $set: 42.5 },
      'shape.decimal': { $set: new Decimal('0.001') },
      'shape.string': { $set: 'hello' },
      'shape.date': { $set: date },
      'shape.object': {
        $set: {
          boolean: true,
          number: 42.5,
          decimal: new Decimal('0.001'),
          string: 'hello',
          date: date,
        }
      },
      'shape.array': { $set: [1, 2, 3, date, new Decimal('0.001')] },
    }, { string: 'insert' });

  expect(upserted.objectId).toStrictEqual(inserted.objectId);
  expect(upserted.__v).toStrictEqual(1);

  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42.5);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  expect(upserted.get('shape.boolean')).toStrictEqual(true);
  expect(upserted.get('shape.number')).toStrictEqual(42.5);
  expect(upserted.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('shape.string')).toStrictEqual('hello');
  expect(upserted.get('shape.date')).toStrictEqual(date);
  expect(upserted.get('shape.object')).toStrictEqual({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('shape.array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test match', async () => {

  const parent = await Proto.Query('Test').insert({});
  let obj;
  for (const i of [1, 2, 3, 4, 5]) {
    obj = await Proto.Query('Test').insert({
      number: i,
      decimal: new Decimal(`0.00${i}`),
      pointer: parent,
    });
  }

  const matched = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .greaterThan('number', 1)
      .sort({ _created_at: 1 })
      .limit(1))
    .first();

  expect(matched?.get('relation2').length).toStrictEqual(1);
  expect(matched?.get('relation2.0.number')).toStrictEqual(2);

  const matched2 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .sort({ _created_at: -1 })
      .limit(1))
    .first();

  expect(matched2?.get('relation2').length).toStrictEqual(1);
  expect(matched2?.get('relation2.0.number')).toStrictEqual(5);

  const matched3 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q.equalTo('decimal', new Decimal(`0.002`)))
    .first();

  expect(matched3?.get('relation2').length).toStrictEqual(1);
  expect(matched3?.get('relation2.0.number')).toStrictEqual(2);

  const matched4 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .sort({ decimal: -1 })
      .limit(1))
    .first();

  expect(matched4?.get('relation2').length).toStrictEqual(1);
  expect(matched4?.get('relation2.0.number')).toStrictEqual(5);

  const matched5 = await Proto.Query('Test')
    .equalTo('_id', parent.objectId)
    .includes('relation2')
    .match('relation2', q => q
      .equalTo('pointer', parent)
      .sort({ decimal: -1 })
      .limit(1))
    .first();

  expect(matched5?.get('relation2').length).toStrictEqual(1);
  expect(matched5?.get('relation2.0.number')).toStrictEqual(5);

  const matched6 = await Proto.Query('Test')
    .equalTo('_id', obj!.objectId)
    .match('pointer.relation2', q => q
      .greaterThan('number', 1)
      .sort({ _created_at: 1 })
      .limit(1))
    .first();

  expect(matched6?.get('pointer.relation2').length).toStrictEqual(1);
  expect(matched6?.get('pointer.relation2.0.number')).toStrictEqual(2);

})

test('test comparable', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
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
    },
    shape: {
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
      },
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.objectId).includes('*', 'relation');

  expect((await q.clone().lessThan('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().lessThan('shape.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('shape.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('shape.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('shape.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().greaterThan('shape.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('shape.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('shape.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThan('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('object.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('object.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().lessThan('shape.object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThan('shape.object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThan('shape.object.date', new Date).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.object.number', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().lessThanOrEqualTo('shape.object.decimal', 0).first())?.objectId).toBeUndefined();
  expect((await q.clone().greaterThanOrEqualTo('shape.object.date', new Date).first())?.objectId).toBeUndefined();

  expect((await q.clone().greaterThan('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().greaterThan('shape.object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThan('shape.object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.decimal', 1).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.decimal', new Decimal('1')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThan('shape.object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.number', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.decimal', 0).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().lessThanOrEqualTo('shape.object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().lessThanOrEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.number', 42.5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().greaterThanOrEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test sort', async () => {
  await Proto.Query('Test').insertMany([
    { string: 'sort', number: 5 },
    { string: 'sort', number: 2 },
    { string: 'sort', number: 3 },
    { string: 'sort', number: 4 },
    { string: 'sort', number: 1 },
  ]);

  const result = await Proto.Query('Test').equalTo('string', 'sort').sort({ number: 1 }).find();
  const result2 = await Proto.Query('Test').equalTo('string', 'sort').sort({ number: -1 }).find();

  expect(_.map(result, x => x.get('number'))).toStrictEqual([1, 2, 3, 4, 5]);
  expect(_.map(result2, x => x.get('number'))).toStrictEqual([5, 4, 3, 2, 1]);
})

test('test sort 2', async () => {
  await Proto.Query('Test').insertMany([
    { string: 'sort2', shape: { number: 5 } },
    { string: 'sort2', shape: { number: 2 } },
    { string: 'sort2', shape: { number: 3 } },
    { string: 'sort2', shape: { number: 4 } },
    { string: 'sort2', shape: { number: 1 } },
  ]);

  const result = await Proto.Query('Test').equalTo('string', 'sort2').sort({ 'shape.number': 1 }).find();
  const result2 = await Proto.Query('Test').equalTo('string', 'sort2').sort({ 'shape.number': -1 }).find();

  expect(_.map(result, x => x.get('shape.number'))).toStrictEqual([1, 2, 3, 4, 5]);
  expect(_.map(result2, x => x.get('shape.number'))).toStrictEqual([5, 4, 3, 2, 1]);
})

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
  expect(await Proto.Query('Test').get(object.objectId!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeTruthy();
  await Proto.logout();
})

test('test permission 4', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: [] });
  object.push('_rperm', ['role:admin']);
  await object.save({ master: true });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'admin' });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeTruthy();
  await Proto.logout();
})

test('test permission 5', async () => {
  const object = await Proto.Query('Test').insert({ _rperm: ['role:admin'] });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeUndefined();
  await Proto.run('createUserWithRole', { role: 'system' });
  expect(await Proto.Query('Test').get(object.objectId!)).toBeTruthy();
  await Proto.logout();
})

test('test transaction', async () => {

  const object = await Proto.Query('Test').insert({});

  const result1 = await Proto.run('updateWithTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect(result1).toStrictEqual({ success: false, error: 'test error' });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toBeNull();

  const result2 = await Proto.run('updateWithTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect(result2).toStrictEqual({ success: true, error: null });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test nested transaction', async () => {

  const object = await Proto.Query('Test').insert({});

  await Proto.run('updateWithNestedTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 0
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(0);

  await Proto.run('updateWithNestedTransaction', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 1
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test long transaction', async () => {

  const object = await Proto.Query('Test').insert({ number: 0 });

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
    Proto.run('updateWithLongTransaction', { id: object.objectId! }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([2, 4, 6, 8, 10]);
})

test('test long transaction 2', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
    Proto.run('updateWithLongTransaction2'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);
})

test('test long transaction 3', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
    Proto.run('updateWithLongTransaction3'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})

test('test transaction session', async () => {

  const object = await Proto.Query('Test').insert({});

  const result1 = await Proto.run('updateWithTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect(result1).toStrictEqual({ success: false, error: 'test error' });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toBeNull();

  const result2 = await Proto.run('updateWithTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect(result2).toStrictEqual({ success: true, error: null });
  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test nested transaction session', async () => {

  const object = await Proto.Query('Test').insert({});

  await Proto.run('updateWithNestedTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 0
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
    error: 'test error',
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(0);

  await Proto.run('updateWithNestedTransactionSession', {
    className: 'Test',
    values: {
      _id: object.objectId!,
      number: 1
    },
    values2: {
      _id: object.objectId!,
      number: 42.5
    },
  });

  expect((await Proto.Query('Test').get(object.objectId!))?.get('number')).toStrictEqual(42.5);

})

test('test long transaction session', async () => {

  const object = await Proto.Query('Test').insert({ number: 0 });

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
    Proto.run('updateWithLongTransactionSession', { id: object.objectId! }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([2, 4, 6, 8, 10]);
})

test('test long transaction session 2', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
    Proto.run('updateWithLongTransactionSession2'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);
})

test('test long transaction session 3', async () => {

  const results = await Promise.all([
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
    Proto.run('updateWithLongTransactionSession3'),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})

test('test long atomic', async () => {

  const inserted = await Proto.Query('Test').insert({
    number: 0,
  });

  const results = await Promise.all([
    Proto.run('updateWithAtomic', { inserted }),
    Proto.run('updateWithAtomic', { inserted }),
    Proto.run('updateWithAtomic', { inserted }),
    Proto.run('updateWithAtomic', { inserted }),
    Proto.run('updateWithAtomic', { inserted }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})

test('test long atomic 2', async () => {

  const inserted = await Proto.Query('Test').insert({
    number: 0,
  });

  const results = await Promise.all([
    Proto.run('updateWithAtomic2', { inserted }),
    Proto.run('updateWithAtomic2', { inserted }),
    Proto.run('updateWithAtomic2', { inserted }),
    Proto.run('updateWithAtomic2', { inserted }),
    Proto.run('updateWithAtomic2', { inserted }),
  ]) as number[];

  expect(results.sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5]);
})

test('test random', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, string: 'random' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'random').random();

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(1, 10));
})

test('test random 2', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, string: 'random2' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'random2').random({ weight: 'number' });

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(1, 10));
})

test('test expr', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, string: 'expr' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'expr')
    .filter({ $expr: { $gt: [{ $key: 'number' }, { $value: 3 }] } })
    .find();

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(4, 10));
})

test('test expr 2', async () => {

  for (const i of _.range(1, 10)) {
    await Proto.Query('Test').insert({ number: i, decimal: new Decimal(i), string: 'expr2' });
  }

  const result = await Proto.Query('Test').equalTo('string', 'expr2')
    .filter({
      $expr: {
        $gt: [
          { $array: [{ $key: 'number' }, { $key: 'decimal' }] },
          { $array: [{ $value: 3 }, { $value: new Decimal(2) }] },
        ]
      }
    })
    .find();

  const result2 = await Proto.Query('Test').equalTo('string', 'expr2')
    .filter({
      $expr: {
        $gt: [
          { $array: [{ $key: 'number' }, { $key: 'decimal' }] },
          { $value: [3, 4] },
        ]
      }
    })
    .find();

  expect(_.map(result, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(3, 10));
  expect(_.map(result2, x => x.get('number')).sort((a, b) => a - b)).toStrictEqual(_.range(4, 10));
})
