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

test('test string', async () => {

  const inserted = await Proto.Query('Test').insert({
    string: 'hello\n\n\nworld',
  });

  expect(inserted.get('string')).toStrictEqual('hello\n\n\nworld');
})

test('test types', async () => {
  const date = new Date;
  const inserted = await Proto.Query('Test').insert({
    boolean: true,
    number: 42.5,
    decimal: new Decimal('0.001'),
    string: 'hello',
    stringArr: ['hello', 'world'],
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
      stringArr: ['hello', 'world'],
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
  expect(inserted.get('stringArr')).toStrictEqual(['hello', 'world']);
  expect(inserted.get('date')).toStrictEqual(date);
  expect(inserted.get('shape.boolean')).toStrictEqual(true);
  expect(inserted.get('shape.number')).toStrictEqual(42.5);
  expect(inserted.get('shape.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('shape.string')).toStrictEqual('hello');
  expect(inserted.get('shape.stringArr')).toStrictEqual(['hello', 'world']);
  expect(inserted.get('shape.date')).toStrictEqual(date);

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().notEqualTo('default', 42).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.default', 42).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('null_boolean', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('null_number', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('null_decimal', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('null_string', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('null_date', null).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.null_boolean', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_number', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_decimal', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_string', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.null_date', null).first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('null_boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('null_number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('null_decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('null_string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('null_date', date).first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('shape.null_boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.null_date', date).first())?.id).toBeUndefined();

  expect((await q.clone().notContainedIn('number', [1, 2, 3, 42.5]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('array.0', [1, 2, 3, 42.5, 'hello']).first())?.id).toBeUndefined();

  expect((await q.clone().notContainedIn('shape.number', [1, 2, 3, 42.5]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('shape.array.0', [1, 2, 3, 42.5, 'hello']).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('stringArr', ['hello', 'world']).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('date', date).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.stringArr', ['hello', 'world']).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.date', date).first())?.id).toBeUndefined();

  expect((await q.clone().endsWith('string', 'hel').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('string', 'llo').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('string', 'ii').first())?.id).toBeUndefined();
  expect((await q.clone().size('string', 4).first())?.id).toBeUndefined();
  expect((await q.clone().empty('string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('null_string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('null_array').first())?.id).toBeUndefined();

  expect((await q.clone().endsWith('shape.string', 'hel').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('shape.string', 'llo').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('shape.string', 'ii').first())?.id).toBeUndefined();
  expect((await q.clone().size('shape.string', 4).first())?.id).toBeUndefined();
  expect((await q.clone().empty('shape.string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('shape.null_string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('shape.null_array').first())?.id).toBeUndefined();

  expect((await q.clone().isDisjoint('stringArr', ['hello']).first())?.id).toBeUndefined();
  expect((await q.clone().size('stringArr', 1).first())?.id).toBeUndefined();
  expect((await q.clone().empty('stringArr').first())?.id).toBeUndefined();

  expect((await q.clone().isDisjoint('shape.stringArr', ['hello']).first())?.id).toBeUndefined();
  expect((await q.clone().size('shape.stringArr', 1).first())?.id).toBeUndefined();
  expect((await q.clone().empty('shape.stringArr').first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('default', 42).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.default', 42).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('null_boolean', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('null_number', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('null_decimal', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('null_string', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('null_date', null).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('shape.null_boolean', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.null_number', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.null_decimal', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.null_string', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.null_date', null).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('null_boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('null_number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('null_decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('null_string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('null_date', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('shape.null_boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.null_number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.null_decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.null_string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.null_date', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().containedIn('number', [1, 2, 3, 42.5]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.number', [1, 2, 3, 42.5]).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('boolean', false).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('number', 10).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('decimal', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('string', 'world').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('date', new Date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('shape.boolean', false).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.number', 10).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.decimal', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.string', 'world').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.date', new Date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().startsWith('string', 'hel').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().endsWith('string', 'llo').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().pattern('string', 'll').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('string', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('null_string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('null_array').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().startsWith('shape.string', 'hel').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().endsWith('shape.string', 'llo').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().pattern('shape.string', 'll').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('shape.string', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('shape.string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('shape.null_string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('shape.null_array').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().isIntersect('stringArr', ['hello']).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('stringArr', 2).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('stringArr').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().isIntersect('shape.stringArr', ['hello']).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('shape.stringArr', 2).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('shape.stringArr').first())?.id).toStrictEqual(inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().notEqualTo('array.0', 1).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('array.1', 2).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('array.2', 3).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('array.3', date).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('array.4', new Decimal('0.001')).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.array.0', 1).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.1', 2).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.2', 3).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.3', date).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.array.4', new Decimal('0.001')).first())?.id).toBeUndefined();

  expect((await q.clone().every('array', q => q.notEqualTo('$', 3)).first())?.id).toBeUndefined();
  expect((await q.clone().some('array', q => q.equalTo('$', null)).first())?.id).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.notEqualTo('$', 3)).first())?.id).toBeUndefined();
  expect((await q.clone().some('shape.array', q => q.equalTo('$', null)).first())?.id).toBeUndefined();

  expect((await q.clone().notContainedIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();

  expect((await q.clone().notContainedIn('shape.array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('shape.array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('shape.array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('shape.array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();
  expect((await q.clone().notContainedIn('shape.array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toBeUndefined();

  expect((await q.clone().isSubset('array', [1, 2, 3]).first())?.id).toBeUndefined();
  expect((await q.clone().isSubset('array', [4, 5, 6]).first())?.id).toBeUndefined();
  expect((await q.clone().isDisjoint('array', [1, 2, 3]).first())?.id).toBeUndefined();
  expect((await q.clone().isSuperset('array', [4, 5, 6]).first())?.id).toBeUndefined();
  expect((await q.clone().isIntersect('array', [4, 5, 6]).first())?.id).toBeUndefined();

  expect((await q.clone().isSubset('shape.array', [1, 2, 3]).first())?.id).toBeUndefined();
  expect((await q.clone().isSubset('shape.array', [4, 5, 6]).first())?.id).toBeUndefined();
  expect((await q.clone().isDisjoint('shape.array', [1, 2, 3]).first())?.id).toBeUndefined();
  expect((await q.clone().isSuperset('shape.array', [4, 5, 6]).first())?.id).toBeUndefined();
  expect((await q.clone().isIntersect('shape.array', [4, 5, 6]).first())?.id).toBeUndefined();

  expect((await q.clone().containedIn('array.0', [1, 2, 3, 42.5, 'hello']).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.array.0', [1, 2, 3, 42.5, 'hello']).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('array.0', 4).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('array.1', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('array.2', 6).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('array.3', new Date).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('array.4', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('shape.array.0', 4).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.array.1', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.array.2', 6).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.array.3', new Date).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.array.4', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('array', q => q.equalTo('$', 3)).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('array', q => q.notEqualTo('$', null)).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.array', q => q.equalTo('$', 3)).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('shape.array', q => q.notEqualTo('$', null)).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().containedIn('array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().containedIn('shape.array.0', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.array.1', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.array.2', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.array.3', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().containedIn('shape.array.4', [1, 2, 3, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().isSubset('array', [1, 2, 3, 4, 5, 6, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isDisjoint('array', [4, 5, 6]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isSuperset('array', [1, 2, 3]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isIntersect('array', [1, 2, 3]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('array').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().isSubset('shape.array', [1, 2, 3, 4, 5, 6, date, new Decimal('0.001')]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isDisjoint('shape.array', [4, 5, 6]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isSuperset('shape.array', [1, 2, 3]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().isIntersect('shape.array', [1, 2, 3]).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('shape.array').first())?.id).toStrictEqual(inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().notEqualTo('object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.null', null).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.null', null).first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('object.null', true).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('object.null', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('object.null', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('object.null', date).first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('shape.object.null', true).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().equalTo('shape.object.null', date).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('object.boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('object.date', date).first())?.id).toBeUndefined();

  expect((await q.clone().notEqualTo('shape.object.boolean', true).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.number', 42.5).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.decimal', new Decimal('0.001')).first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.string', 'hello').first())?.id).toBeUndefined();
  expect((await q.clone().notEqualTo('shape.object.date', date).first())?.id).toBeUndefined();

  expect((await q.clone().endsWith('object.string', 'hel').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'llo').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('object.string', 'ii').first())?.id).toBeUndefined();
  expect((await q.clone().size('object.string', 4).first())?.id).toBeUndefined();
  expect((await q.clone().empty('object.string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_string').first())?.id).toBeUndefined();

  expect((await q.clone().endsWith('shape.object.string', 'hel').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('shape.object.string', 'llo').first())?.id).toBeUndefined();
  expect((await q.clone().startsWith('shape.object.string', 'ii').first())?.id).toBeUndefined();
  expect((await q.clone().size('shape.object.string', 4).first())?.id).toBeUndefined();
  expect((await q.clone().empty('shape.object.string').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('shape.object.null_string').first())?.id).toBeUndefined();

  expect((await q.clone().empty('object.array').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('object.null_array').first())?.id).toBeUndefined();

  expect((await q.clone().empty('shape.object.array').first())?.id).toBeUndefined();
  expect((await q.clone().notEmpty('shape.object.null_array').first())?.id).toBeUndefined();

  expect((await q.clone().equalTo('object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.null', null).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('shape.object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.null', null).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('object.null', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.null', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.null', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.null', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.null', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('shape.object.null', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.null', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.null', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.null', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.null', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('object.boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('object.date', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().equalTo('shape.object.boolean', true).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.number', 42.5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.decimal', new Decimal('0.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.string', 'hello').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().equalTo('shape.object.date', date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('object.boolean', false).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.number', 10).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.string', 'world').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('object.date', new Date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEqualTo('shape.object.boolean', false).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.number', 10).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.decimal', new Decimal('1.001')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.string', 'world').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEqualTo('shape.object.date', new Date).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().startsWith('object.string', 'hel').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().endsWith('object.string', 'llo').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().pattern('object.string', 'll').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('object.string', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('object.string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('object.null_string').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().startsWith('shape.object.string', 'hel').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().endsWith('shape.object.string', 'llo').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().pattern('shape.object.string', 'll').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().size('shape.object.string', 5).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().notEmpty('shape.object.string').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('shape.object.null_string').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEmpty('object.array').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('object.null_array').first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().notEmpty('shape.object.array').first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().empty('shape.object.null_array').first())?.id).toStrictEqual(inserted.id);

})

test('test types 4', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6]],
    shape: {
      array: [[1, 2, 3], [4, 5, 6]],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().size('array', 0).first())?.id).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().size('shape.array', 0).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().size('array', 2).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('array', q => q.size('$', 3)).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().size('shape.array', 2).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('shape.array', q => q.size('$', 3)).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.array', q => q.some('$', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

})

test('test types 5', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
    shape: {
      array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.array', q => q.some('array', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

})

test('test types 6', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6], new Date],
    shape: {
      array: [[1, 2, 3], [4, 5, 6], new Date],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().every('array', q => q.every('$', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.every('$', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('$', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.array', q => q.some('$', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.array', q => q.some('$', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

})

test('test types 7', async () => {
  const inserted = await Proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }, new Date],
    shape: {
      array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }, new Date],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().every('array', q => q.every('array', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();
  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().every('shape.array', q => q.every('array', q => q.equalTo('$', 0))).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.id).toBeUndefined();

  expect((await q.clone().some('array', q => q.some('array', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.array', q => q.some('array', q => q.equalTo('$', 1))).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.array', q => q.some('array', q => q.notEqualTo('$', 0))).first())?.id).toStrictEqual(inserted.id);

})

test('test types 8', async () => {

  const inserted1 = await Proto.Query('Test').insert({
    string: '',
  });

  const q1 = Proto.Query('Test').equalTo('_id', inserted1.id);

  expect((await q1.clone().containedIn('string', ['', null]).first())?.id).toStrictEqual(inserted1.id);
  expect((await q1.clone().notContainedIn('string', ['', null]).first())?.id).toBeUndefined();

  const inserted2 = await Proto.Query('Test').insert({
    string: null,
  });

  const q2 = Proto.Query('Test').equalTo('_id', inserted2.id);

  expect((await q2.clone().containedIn('string', ['', null]).first())?.id).toStrictEqual(inserted2.id);
  expect((await q2.clone().notContainedIn('string', ['', null]).first())?.id).toBeUndefined();

  const inserted3 = await Proto.Query('Test').insert({
    string: 'test',
  });

  const q3 = Proto.Query('Test').equalTo('_id', inserted3.id);

  expect((await q3.clone().containedIn('string', ['', null]).first())?.id).toBeUndefined();
  expect((await q3.clone().notContainedIn('string', ['', null]).first())?.id).toStrictEqual(inserted3.id);
})

test('test types 9', async () => {
  const inserted = await Proto.Query('Test').insert({
    stringArr: ['hello', 'world'],
    shape: {
      stringArr: ['hello', 'world'],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().every('stringArr', q => q.equalTo('$', 'hello')).first())?.id).toBeUndefined();
  expect((await q.clone().every('stringArr', q => q.notEqualTo('$', 'hello')).first())?.id).toBeUndefined();
  expect((await q.clone().every('stringArr', q => q.startsWith('$', 'hel')).first())?.id).toBeUndefined();

  expect((await q.clone().every('shape.stringArr', q => q.equalTo('$', 'hello')).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.stringArr', q => q.notEqualTo('$', 'hello')).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.stringArr', q => q.startsWith('$', 'hel')).first())?.id).toBeUndefined();

  expect((await q.clone().some('stringArr', q => q.equalTo('$', 'hello')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('stringArr', q => q.notEqualTo('$', 'hello')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('stringArr', q => q.startsWith('$', 'hel')).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.stringArr', q => q.equalTo('$', 'hello')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.stringArr', q => q.notEqualTo('$', 'hello')).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.stringArr', q => q.startsWith('$', 'hel')).first())?.id).toStrictEqual(inserted.id);

})

test('test types 10', async () => {
  const inserted = await Proto.Query('Test').insert({
    vector: [1, 2, 3],
    shape: {
      vector: [1, 2, 3],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().every('vector', q => q.equalTo('$', 1)).first())?.id).toBeUndefined();
  expect((await q.clone().every('vector', q => q.notEqualTo('$', 1)).first())?.id).toBeUndefined();

  expect((await q.clone().every('shape.vector', q => q.equalTo('$', 1)).first())?.id).toBeUndefined();
  expect((await q.clone().every('shape.vector', q => q.notEqualTo('$', 1)).first())?.id).toBeUndefined();

  expect((await q.clone().some('vector', q => q.equalTo('$', 1)).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('vector', q => q.notEqualTo('$', 1)).first())?.id).toStrictEqual(inserted.id);

  expect((await q.clone().some('shape.vector', q => q.equalTo('$', 1)).first())?.id).toStrictEqual(inserted.id);
  expect((await q.clone().some('shape.vector', q => q.notEqualTo('$', 1)).first())?.id).toStrictEqual(inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

  const q = Proto.Query('Test').equalTo('_id', inserted.id).includes('relation', 'shape');

  expect((await q.clone().updateOne({ relation: { $addToSet: [obj2, obj3, obj4] } }))?.get('relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj4].map(x => x.id).sort());
  expect((await q.clone().updateOne({ relation: { $push: [obj4, obj5] } }))?.get('relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj4, obj5].map(x => x.id).sort());
  expect((await q.clone().updateOne({ relation: { $removeAll: [obj4] } }))?.get('relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj5].map(x => x.id).sort());

  expect((await q.clone().updateOne({ 'shape.relation': { $addToSet: [obj2, obj3, obj4] } }))?.get('shape.relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj4].map(x => x.id).sort());
  expect((await q.clone().updateOne({ 'shape.relation': { $push: [obj4, obj5] } }))?.get('shape.relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj4, obj5].map(x => x.id).sort());
  expect((await q.clone().updateOne({ 'shape.relation': { $removeAll: [obj4] } }))?.get('shape.relation').map((x: any) => x.id).sort()).toStrictEqual([obj1, obj2, obj3, obj5].map(x => x.id).sort());
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

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

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

test('test update types 9', async () => {
  const inserted = await Proto.Query('Test').insert({
    stringArr: ['1', '2', '3'],
    shape: {
      stringArr: ['1', '2', '3'],
    },
  });

  const q = Proto.Query('Test').equalTo('_id', inserted.id);

  expect((await q.clone().updateOne({ stringArr: { $addToSet: ['2', '3', '4'] } }))?.get('stringArr')).toStrictEqual(['1', '2', '3', '4']);
  expect((await q.clone().updateOne({ stringArr: { $push: ['4', '5'] } }))?.get('stringArr')).toStrictEqual(['1', '2', '3', '4', '4', '5']);
  expect((await q.clone().updateOne({ stringArr: { $removeAll: ['4'] } }))?.get('stringArr')).toStrictEqual(['1', '2', '3', '5']);
  expect((await q.clone().updateOne({ stringArr: { $popFirst: 1 } }))?.get('stringArr')).toStrictEqual(['2', '3', '5']);
  expect((await q.clone().updateOne({ stringArr: { $popLast: 1 } }))?.get('stringArr')).toStrictEqual(['2', '3']);

  expect((await q.clone().updateOne({ 'shape.stringArr': { $addToSet: ['2', '3', '4'] } }))?.get('shape.stringArr')).toStrictEqual(['1', '2', '3', '4']);
  expect((await q.clone().updateOne({ 'shape.stringArr': { $push: ['4', '5'] } }))?.get('shape.stringArr')).toStrictEqual(['1', '2', '3', '4', '4', '5']);
  expect((await q.clone().updateOne({ 'shape.stringArr': { $removeAll: ['4'] } }))?.get('shape.stringArr')).toStrictEqual(['1', '2', '3', '5']);
  expect((await q.clone().updateOne({ 'shape.stringArr': { $popFirst: 1 } }))?.get('shape.stringArr')).toStrictEqual(['2', '3', '5']);
  expect((await q.clone().updateOne({ 'shape.stringArr': { $popLast: 1 } }))?.get('shape.stringArr')).toStrictEqual(['2', '3']);
})
