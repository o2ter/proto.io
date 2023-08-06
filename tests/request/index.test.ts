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

import { masterKey } from './server';
import fs from 'fs';
import { test, expect } from '@jest/globals';
import { UUID } from 'bson';
import Decimal from 'decimal.js';
import ProtoClient, { UpdateOp } from '../../src/client';

const proto = new ProtoClient({
  endpoint: 'http://localhost:8080',
  masterKey,
});

test('echo', async () => {
  const result = await proto.run('echo', 'hello, world');
  expect(result).toStrictEqual('hello, world');
});
test('test codec', async () => {

  const obj = {
    hello: 'world',
    $array: [1, 2, null, { string: '' }],
    decimal: new Decimal('10.05'),
    date: new Date(),
    uuid: new UUID(),
  };

  const result = await proto.run('echo', obj);
  expect(result).toStrictEqual(obj);
});
test('test files', async () => {
  const file = proto.File('test.txt', 'hello, world', 'text/plain');
  await file.save();
});
test('test files 2', async () => {
  const file = proto.File('test.txt', fs.createReadStream(__filename), 'text/plain');
  await file.save();
});

test('test insert', async () => {
  const inserted = await proto.Query('Test').insert({ string: 'hello' });
  expect(inserted.objectId).toBeTruthy();
  expect(inserted.get('string')).toStrictEqual('hello');
})

test('test types', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  expect(inserted.get('boolean')).toStrictEqual(true);
  expect(inserted.get('number')).toStrictEqual(42);
  expect(inserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(inserted.get('string')).toStrictEqual('hello');
  expect(inserted.get('date')).toStrictEqual(date);
  expect(inserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(inserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);

  const q = proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().notEqualTo('default', 42).first())?.objectId).toBe(undefined);

  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.null', null).first())?.objectId).toBe(undefined);

  expect((await q.clone().notEqualTo('null_boolean', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('null_number', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('null_decimal', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('null_string', null).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('null_date', null).first())?.objectId).toBe(undefined);

  expect((await q.clone().equalTo('object.null', true).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('object.null', 42).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('object.null', new Decimal('0.001')).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('object.null', 'hello').first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('object.null', date).first())?.objectId).toBe(undefined);

  expect((await q.clone().equalTo('null_boolean', true).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('null_number', 42).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('null_decimal', new Decimal('0.001')).first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('null_string', 'hello').first())?.objectId).toBe(undefined);
  expect((await q.clone().equalTo('null_date', date).first())?.objectId).toBe(undefined);

  expect((await q.clone().notContainsIn('number', [1, 2, 3, 42]).first())?.objectId).toBe(undefined);
  expect((await q.clone().notContainsIn('array.0', [1, 2, 3, 42, 'hello']).first())?.objectId).toBe(undefined);

  expect((await q.clone().notEqualTo('boolean', true).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('number', 42).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('decimal', new Decimal('0.001')).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('string', 'hello').first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('date', date).first())?.objectId).toBe(undefined);

  expect((await q.clone().notEqualTo('object.boolean', true).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.number', 42).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('0.001')).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.string', 'hello').first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('object.date', date).first())?.objectId).toBe(undefined);

  expect((await q.clone().notEqualTo('array.0', 1).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('array.1', 2).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('array.2', 3).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('array.3', date).first())?.objectId).toBe(undefined);
  expect((await q.clone().notEqualTo('array.4', new Decimal('0.001')).first())?.objectId).toBe(undefined);

  expect((await q.clone().every('array', q => q.notEqualTo('$', 3)).first())?.objectId).toBe(undefined);
  expect((await q.clone().some('array', q => q.equalTo('$', null)).first())?.objectId).toBe(undefined);

  expect((await q.clone().equalTo('default', 42).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.null', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('null_boolean', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_number', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_decimal', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_string', null).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('null_date', null).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.null', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.null', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('null_boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('null_date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().containsIn('number', [1, 2, 3, 42]).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().containsIn('array.0', [1, 2, 3, 42, 'hello']).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().equalTo('object.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('object.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('object.boolean', false).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.number', 10).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.decimal', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.string', 'world').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('object.date', new Date).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().notEqualTo('array.0', 4).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.1', 5).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.2', 6).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.3', new Date).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().notEqualTo('array.4', new Decimal('1.001')).first())?.objectId).toStrictEqual(inserted.objectId);

  expect((await q.clone().some('array', q => q.equalTo('$', 3)).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().every('array', q => q.notEqualTo('$', null)).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 2', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    array: [[1, 2, 3], [4, 5, 6]],
  });

  const q = proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('$', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test types 3', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    array: [{ array: [1, 2, 3] }, { array: [4, 5, 6] }],
  });

  const q = proto.Query('Test').equalTo('_id', inserted.objectId);

  expect((await q.clone().every('array', q => q.every('array', q => q.notEqualTo('$', 0))).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test pointer', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('pointer')
    .updateOne({
      pointer: [UpdateOp.set, inserted],
    });

  expect(updated?.get('pointer.boolean')).toStrictEqual(true);
  expect(updated?.get('pointer.number')).toStrictEqual(42);
  expect(updated?.get('pointer.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('pointer.string')).toStrictEqual('hello');
  expect(updated?.get('pointer.date')).toStrictEqual(date);

  const q = proto.Query('Test').equalTo('_id', inserted.objectId).includes('pointer');

  expect((await q.clone().equalTo('pointer.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('pointer.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation')
    .updateOne({
      relation: [UpdateOp.set, [inserted]],
    });

  expect(updated?.get('relation.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation.0.number')).toStrictEqual(42);
  expect(updated?.get('relation.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation.0.date')).toStrictEqual(date);

  const q = proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation');

  expect((await q.clone().equalTo('relation.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 2', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation2')
    .updateOne({
      pointer: [UpdateOp.set, inserted],
    });

  expect((updated?.get('relation2') as any).length).toStrictEqual(1);
  expect(updated?.get('relation2.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation2.0.number')).toStrictEqual(42);
  expect(updated?.get('relation2.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation2.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation2.0.date')).toStrictEqual(date);

  const q = proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation2');

  expect((await q.clone().equalTo('relation2.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation2.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test relation 3', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
    object: {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
    },
    array: [1, 2, 3, date, new Decimal('0.001')],
  });
  const updated = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .includes('relation3')
    .updateOne({
      relation: [UpdateOp.set, [inserted]],
    });

  expect(updated?.get('relation3').length).toStrictEqual(1);
  expect(updated?.get('relation3.0.boolean')).toStrictEqual(true);
  expect(updated?.get('relation3.0.number')).toStrictEqual(42);
  expect(updated?.get('relation3.0.decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('relation3.0.string')).toStrictEqual('hello');
  expect(updated?.get('relation3.0.date')).toStrictEqual(date);

  const q = proto.Query('Test').equalTo('_id', inserted.objectId).includes('relation3');

  expect((await q.clone().equalTo('relation3.0.boolean', true).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.number', 42).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.decimal', new Decimal('0.001')).first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.string', 'hello').first())?.objectId).toStrictEqual(inserted.objectId);
  expect((await q.clone().equalTo('relation3.0.date', date).first())?.objectId).toStrictEqual(inserted.objectId);

})

test('test update', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({});
  const updated = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .updateOne({
      boolean: [UpdateOp.set, true],
      number: [UpdateOp.set, 42],
      decimal: [UpdateOp.set, new Decimal('0.001')],
      string: [UpdateOp.set, 'hello'],
      date: [UpdateOp.set, date],
      object: [UpdateOp.set, {
        boolean: true,
        number: 42,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      }],
      array: [UpdateOp.set, [1, 2, 3, date, new Decimal('0.001')]],
    });
  expect(updated?.objectId).toStrictEqual(inserted.objectId);
  expect(updated?.version).toStrictEqual(1);
  expect(updated?.get('boolean')).toStrictEqual(true);
  expect(updated?.get('number')).toStrictEqual(42);
  expect(updated?.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(updated?.get('string')).toStrictEqual('hello');
  expect(updated?.get('date')).toStrictEqual(date);
  expect(updated?.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(updated?.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert', async () => {
  const date = new Date;
  const upserted = await proto.Query('Test')
    .equalTo('_id', '')
    .upsertOne({ string: [UpdateOp.set, 'update'] }, {
      boolean: true,
      number: 42,
      decimal: new Decimal('0.001'),
      string: 'hello',
      date: date,
      object: {
        boolean: true,
        number: 42,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      },
      array: [1, 2, 3, date, new Decimal('0.001')],
    });
  expect(upserted.objectId).toBeTruthy();
  expect(upserted.version).toStrictEqual(0);
  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})

test('test upsert 2', async () => {
  const date = new Date;
  const inserted = await proto.Query('Test').insert({});
  const upserted = await proto.Query('Test')
    .equalTo('_id', inserted.objectId)
    .upsertOne({
      boolean: [UpdateOp.set, true],
      number: [UpdateOp.set, 42],
      decimal: [UpdateOp.set, new Decimal('0.001')],
      string: [UpdateOp.set, 'hello'],
      date: [UpdateOp.set, date],
      object: [UpdateOp.set, {
        boolean: true,
        number: 42,
        decimal: new Decimal('0.001'),
        string: 'hello',
        date: date,
      }],
      array: [UpdateOp.set, [1, 2, 3, date, new Decimal('0.001')]],
    }, { string: 'insert' });
  expect(upserted.objectId).toStrictEqual(inserted.objectId);
  expect(upserted.version).toStrictEqual(1);
  expect(upserted.get('boolean')).toStrictEqual(true);
  expect(upserted.get('number')).toStrictEqual(42);
  expect(upserted.get('decimal')).toStrictEqual(new Decimal('0.001'));
  expect(upserted.get('string')).toStrictEqual('hello');
  expect(upserted.get('date')).toStrictEqual(date);
  expect(upserted.get('object')).toStrictEqual({
    boolean: true,
    number: 42,
    decimal: new Decimal('0.001'),
    string: 'hello',
    date: date,
  });
  expect(upserted.get('array')).toStrictEqual([1, 2, 3, date, new Decimal('0.001')]);
})
