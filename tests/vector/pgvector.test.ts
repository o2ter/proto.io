//
//  pgvector.test.ts
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

import { test, expect } from '@jest/globals';
import { PGVectorSettings } from '../../src/adapters/storage/postgres/client/pgvector';

const makeSettings = () => {
  const queries: string[] = [];
  const settings = new PGVectorSettings({
    _query: async (query: string) => {
      queries.push(query);
      return [];
    },
  } as any);
  return { queries, settings };
};

test('sets all pgvector HNSW settings', async () => {

  const { queries, settings } = makeSettings();

  await settings.setHnsw({
    efSearch: 100,
    iterativeScan: 'strict_order',
    maxScanTuples: 20000,
    scanMemMultiplier: 2,
  }, { local: true });

  expect(queries).toStrictEqual([
    'SET LOCAL hnsw.ef_search = 100',
    "SET LOCAL hnsw.iterative_scan = 'strict_order'",
    'SET LOCAL hnsw.max_scan_tuples = 20000',
    'SET LOCAL hnsw.scan_mem_multiplier = 2',
  ]);

});

test('sets all pgvector IVFFlat settings', async () => {

  const { queries, settings } = makeSettings();

  await settings.setIvfflat({
    probes: 10,
    iterativeScan: 'relaxed_order',
    maxProbes: 100,
  });

  expect(queries).toStrictEqual([
    'SET ivfflat.probes = 10',
    "SET ivfflat.iterative_scan = 'relaxed_order'",
    'SET ivfflat.max_probes = 100',
  ]);

});

test('sets iterative scan for both pgvector index methods', async () => {

  const { queries, settings } = makeSettings();

  await settings.setIterativeScan('off');

  expect(queries).toStrictEqual([
    "SET hnsw.iterative_scan = 'off'",
    "SET ivfflat.iterative_scan = 'off'",
  ]);

});

test('rejects pgvector settings outside supported ranges', async () => {

  const { queries, settings } = makeSettings();

  await expect(settings.setHnswEfSearch(0)).rejects.toThrow('hnsw.ef_search must be an integer between 1 and 1000');
  await expect(settings.setIvfflatProbes(32769)).rejects.toThrow('ivfflat.probes must be an integer between 1 and 32768');
  await expect(settings.setHnswScanMemMultiplier(Number.POSITIVE_INFINITY)).rejects.toThrow('hnsw.scan_mem_multiplier must be a finite number between 1 and 1000');

  expect(queries).toStrictEqual([]);

});

test('resets all pgvector settings', async () => {

  const { queries, settings } = makeSettings();

  await settings.resetAll();

  expect(queries).toStrictEqual([
    'RESET hnsw.ef_search',
    'RESET hnsw.iterative_scan',
    'RESET hnsw.max_scan_tuples',
    'RESET hnsw.scan_mem_multiplier',
    'RESET ivfflat.probes',
    'RESET ivfflat.iterative_scan',
    'RESET ivfflat.max_probes',
  ]);

});
