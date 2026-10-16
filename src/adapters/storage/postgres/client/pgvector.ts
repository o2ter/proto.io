//
//  pgvector.ts
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

import type { PostgresStorageClient } from './base';
import type { PostgresClientDriver } from '../driver';

export const PGVECTOR_LIMITS = {
  hnsw: {
    m: { min: 2, max: 100 },
    efConstruction: { min: 4, max: 1000 },
    efSearch: { min: 1, max: 1000 },
    maxScanTuples: { min: 1, max: Number.MAX_SAFE_INTEGER },
    scanMemMultiplier: { min: 1, max: 1000 },
  },
  ivfflat: {
    lists: { min: 1, max: 32768 },
    probes: { min: 1, max: 32768 },
    maxProbes: { min: 1, max: 32768 },
  },
} as const;

export type PGVectorIterativeScan = 'off' | 'relaxed_order' | 'strict_order';

export type PGVectorSetOptions = {
  local?: boolean;
};

export type PGVectorHnswSettings = {
  efSearch?: number;
  iterativeScan?: PGVectorIterativeScan;
  maxScanTuples?: number;
  scanMemMultiplier?: number;
};

export type PGVectorIvfflatSettings = {
  probes?: number;
  iterativeScan?: PGVectorIterativeScan;
  maxProbes?: number;
};

const assertIntegerInRange = (
  name: string,
  value: number,
  min: number,
  max: number,
) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw Error(`${name} must be an integer between ${min} and ${max}`);
  }
};

const assertNumberInRange = (
  name: string,
  value: number,
  min: number,
  max: number,
) => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw Error(`${name} must be a finite number between ${min} and ${max}`);
  }
};

export const assertPGVectorHnswIndexOptions = (options: {
  m?: number;
  efConstruction?: number;
}) => {
  if (options.m !== undefined) {
    assertIntegerInRange('hnsw.m', options.m, PGVECTOR_LIMITS.hnsw.m.min, PGVECTOR_LIMITS.hnsw.m.max);
  }
  if (options.efConstruction !== undefined) {
    assertIntegerInRange(
      'hnsw.efConstruction',
      options.efConstruction,
      PGVECTOR_LIMITS.hnsw.efConstruction.min,
      PGVECTOR_LIMITS.hnsw.efConstruction.max,
    );
  }
};

export const assertPGVectorIvfflatIndexOptions = (options: {
  lists?: number;
}) => {
  if (options.lists !== undefined) {
    assertIntegerInRange(
      'ivfflat.lists',
      options.lists,
      PGVECTOR_LIMITS.ivfflat.lists.min,
      PGVECTOR_LIMITS.ivfflat.lists.max,
    );
  }
};

export class PGVectorSettings<Driver extends PostgresClientDriver> {

  client: PostgresStorageClient<Driver>;

  constructor(client: PostgresStorageClient<Driver>) {
    this.client = client;
  }

  #formatValue(value: number | PGVectorIterativeScan) {
    return typeof value === 'number' ? `${value}` : `'${value}'`;
  }

  async #setValue(key: string, value: number | PGVectorIterativeScan, options?: PGVectorSetOptions) {
    await this.client._query(`${options?.local ? 'SET LOCAL' : 'SET'} ${key} = ${this.#formatValue(value)}`);
  }

  async #resetValue(key: string) {
    await this.client._query(`RESET ${key}`);
  }

  async setHnswEfSearch(value: number, options?: PGVectorSetOptions) {
    assertIntegerInRange(
      'hnsw.ef_search',
      value,
      PGVECTOR_LIMITS.hnsw.efSearch.min,
      PGVECTOR_LIMITS.hnsw.efSearch.max,
    );
    await this.#setValue('hnsw.ef_search', value, options);
  }

  async setHnswIterativeScan(value: PGVectorIterativeScan, options?: PGVectorSetOptions) {
    await this.#setValue('hnsw.iterative_scan', value, options);
  }

  async setHnswMaxScanTuples(value: number, options?: PGVectorSetOptions) {
    assertIntegerInRange(
      'hnsw.max_scan_tuples',
      value,
      PGVECTOR_LIMITS.hnsw.maxScanTuples.min,
      PGVECTOR_LIMITS.hnsw.maxScanTuples.max,
    );
    await this.#setValue('hnsw.max_scan_tuples', value, options);
  }

  async setHnswScanMemMultiplier(value: number, options?: PGVectorSetOptions) {
    assertNumberInRange(
      'hnsw.scan_mem_multiplier',
      value,
      PGVECTOR_LIMITS.hnsw.scanMemMultiplier.min,
      PGVECTOR_LIMITS.hnsw.scanMemMultiplier.max,
    );
    await this.#setValue('hnsw.scan_mem_multiplier', value, options);
  }

  async setHnsw(settings: PGVectorHnswSettings, options?: PGVectorSetOptions) {
    if (settings.efSearch !== undefined) await this.setHnswEfSearch(settings.efSearch, options);
    if (settings.iterativeScan !== undefined) await this.setHnswIterativeScan(settings.iterativeScan, options);
    if (settings.maxScanTuples !== undefined) await this.setHnswMaxScanTuples(settings.maxScanTuples, options);
    if (settings.scanMemMultiplier !== undefined) await this.setHnswScanMemMultiplier(settings.scanMemMultiplier, options);
  }

  async setIvfflatProbes(value: number, options?: PGVectorSetOptions) {
    assertIntegerInRange(
      'ivfflat.probes',
      value,
      PGVECTOR_LIMITS.ivfflat.probes.min,
      PGVECTOR_LIMITS.ivfflat.probes.max,
    );
    await this.#setValue('ivfflat.probes', value, options);
  }

  async setIvfflatIterativeScan(value: PGVectorIterativeScan, options?: PGVectorSetOptions) {
    await this.#setValue('ivfflat.iterative_scan', value, options);
  }

  async setIvfflatMaxProbes(value: number, options?: PGVectorSetOptions) {
    assertIntegerInRange(
      'ivfflat.max_probes',
      value,
      PGVECTOR_LIMITS.ivfflat.maxProbes.min,
      PGVECTOR_LIMITS.ivfflat.maxProbes.max,
    );
    await this.#setValue('ivfflat.max_probes', value, options);
  }

  async setIvfflat(settings: PGVectorIvfflatSettings, options?: PGVectorSetOptions) {
    if (settings.probes !== undefined) await this.setIvfflatProbes(settings.probes, options);
    if (settings.iterativeScan !== undefined) await this.setIvfflatIterativeScan(settings.iterativeScan, options);
    if (settings.maxProbes !== undefined) await this.setIvfflatMaxProbes(settings.maxProbes, options);
  }

  async setIterativeScan(value: PGVectorIterativeScan, options?: PGVectorSetOptions) {
    await this.setHnswIterativeScan(value, options);
    await this.setIvfflatIterativeScan(value, options);
  }

  set iterative_scan(value: PGVectorIterativeScan) {
    void this.setIterativeScan(value);
  }

  async resetHnsw() {
    await this.#resetValue('hnsw.ef_search');
    await this.#resetValue('hnsw.iterative_scan');
    await this.#resetValue('hnsw.max_scan_tuples');
    await this.#resetValue('hnsw.scan_mem_multiplier');
  }

  async resetIvfflat() {
    await this.#resetValue('ivfflat.probes');
    await this.#resetValue('ivfflat.iterative_scan');
    await this.#resetValue('ivfflat.max_probes');
  }

  async resetAll() {
    await this.resetHnsw();
    await this.resetIvfflat();
  }
}
