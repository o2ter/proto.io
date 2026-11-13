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
import { database, masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../src/client/proto';
import { sql } from '../../src/adapters/storage/sql';
import { TSchema } from '../../src/internals/schema';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8080/proto',
  masterUser,
});

test('test unique', async () => {

  const inserted = await Proto.Query('Test').insert({ unique: 1 });
  expect(inserted.id).toBeTruthy();
  expect(inserted.get('unique')).toStrictEqual(1);

  const inserted2 = await Proto.Query('Test').insert({ unique: 2 });
  expect(inserted2.id).toBeTruthy();
  expect(inserted2.get('unique')).toStrictEqual(2);

  await expect(() => Proto.Query('Test').insert({ unique: 1 })).rejects.toThrow();
})

test('partial unique indexes only constrain matching rows', async () => {
  await Proto.Query('PartialTest').insert({ value: 'same', active: false });
  await Proto.Query('PartialTest').insert({ value: 'same', active: false });
  await Proto.Query('PartialTest').insert({ value: 'same', active: true });
  await expect(Proto.Query('PartialTest').insert({ value: 'same', active: true })).rejects.toThrow();
  await expect(Proto.Query('PartialTest').equalTo('active', false).updateMany({ active: { $set: true } })).rejects.toThrow();
});

test('partial indexes coexist and migrate when predicates change or are removed', async () => {
  const className = 'PartialIndexMigration';
  const makeSchema = (filter: TSchema.IndexPredicate): TSchema => ({
    fields: {
      value: 'string',
      active: 'boolean',
      details: { type: 'shape', shape: { score: 'number' } },
      embedding: { type: 'vector', dimension: 2 },
    },
    indexes: [
      { keys: { value: 1 }, unique: true, filter },
      { keys: { value: 1 }, filter: { 'details.score': { $gte: 2.5 } } },
      { type: 'vector', keys: 'embedding', filter },
    ],
  });
  const indexes = async () => await database.query(sql`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = ${{ value: className }}
  `);
  const active = { active: { $eq: true } };
  await database.prepare({ [className]: makeSchema(active) }, true);
  const first = await indexes();
  expect(first.filter(row => row.indexdef.includes(' WHERE '))).toHaveLength(6);

  await database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active) VALUES ('1', 'x', true), ('2', 'x', false)`);
  const inactive = { active: { $eq: false } };
  await database.prepare({ [className]: makeSchema(inactive) }, true);
  const second = await indexes();
  const oldNames = first.filter(row => row.indexdef.includes(' WHERE ')).map(row => row.indexname);
  const newNames = second.filter(row => row.indexdef.includes(' WHERE ')).map(row => row.indexname);
  expect(newNames).toHaveLength(6);
  expect(newNames.filter(name => oldNames.includes(name))).toHaveLength(1);
  await database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active) VALUES ('3', 'x', true)`);
  await expect(database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active) VALUES ('4', 'x', false)`)).rejects.toThrow();

  const noIndexes = { ...makeSchema(inactive), indexes: [] };
  await database.prepare({ [className]: noIndexes }, true);
  expect((await indexes()).filter(row => row.indexdef.includes(' WHERE '))).toHaveLength(0);
});

test('partial index predicates support logical operations and quoted values', async () => {
  const className = 'PartialIndexPredicate';
  const schema: TSchema = {
    fields: { value: 'string', active: 'boolean', score: 'number' },
    indexes: [{
      keys: { value: 1 },
      unique: true,
      filter: { $and: [
        { value: { $eq: "O'Reilly" } },
        { $or: [{ active: { $eq: true } }, { score: { $gt: 1.5 } }] },
        { $nor: [{ score: { $eq: null } }] },
      ] },
    }],
  };
  await database.prepare({ [className]: schema }, true);
  await database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active, score) VALUES ('1', ${{ value: "O'Reilly" }}, true, 2)`);
  await expect(database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active, score) VALUES ('2', ${{ value: "O'Reilly" }}, false, 3)`)).rejects.toThrow();
  await database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active, score) VALUES ('3', ${{ value: "O'Reilly" }}, false, 1)`);
  await database.query(sql`INSERT INTO ${{ identifier: className }} (_id, value, active, score) VALUES ('4', ${{ value: "O'Reilly" }}, true, NULL)`);

  const invalid: TSchema = { ...schema, indexes: [{ keys: { value: 1 }, filter: { missing: { $eq: true } } }] };
  await expect(database.prepare({ [className]: invalid }, true)).rejects.toThrow('Invalid index filter field: missing');
});
