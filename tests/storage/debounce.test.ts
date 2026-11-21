//
//  debounce.test.ts
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

import { expect, jest, test } from '@jest/globals';
import { createCacheDebounce } from '../../src/internals/debounce';

test('expires each cached result after its last use', async () => {
  jest.useFakeTimers();
  try {
    const debounce = createCacheDebounce(1000);
    const callback = jest.fn(async (key: string) => key);
    expect(await debounce('a', callback)).toBe('a');
    expect(await debounce('b', callback)).toBe('b');

    jest.advanceTimersByTime(800);
    expect(await debounce('a', callback)).toBe('a');
    jest.advanceTimersByTime(200);
    expect(await debounce('b', callback)).toBe('b');
    expect(await debounce('a', callback)).toBe('a');
    expect(callback).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(999);
    expect(await debounce('a', callback)).toBe('a');
    expect(callback).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(1000);
    expect(await debounce('a', callback)).toBe('a');
    expect(callback).toHaveBeenCalledTimes(4);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('coalesces slow calls and starts the timeout after resolution', async () => {
  jest.useFakeTimers();
  try {
    const debounce = createCacheDebounce(1000);
    let resolve!: (value: string) => void;
    const gate = new Promise<string>(done => { resolve = done; });
    const callback = jest.fn(() => gate);
    const first = debounce('key', callback);
    jest.advanceTimersByTime(2000);
    const second = debounce('key', callback);
    expect(callback).toHaveBeenCalledTimes(1);
    resolve('value');
    expect(await first).toBe('value');
    expect(await second).toBe('value');
    jest.advanceTimersByTime(999);
    expect(await debounce('key', callback)).toBe('value');
    expect(callback).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(await debounce('key', callback)).toBe('value');
    expect(callback).toHaveBeenCalledTimes(2);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test.each([undefined, 1000])('retries failures with timeout %s', async timeout => {
  jest.useFakeTimers();
  try {
    const debounce = createCacheDebounce(timeout);
    const failure = Error('failure');
    const callback = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue('value');
    const first = debounce('key', callback);
    const second = debounce('key', callback);
    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(await debounce('key', callback)).toBe('value');
    expect(callback).toHaveBeenCalledTimes(2);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('does not retain results with no timeout', async () => {
  const debounce = createCacheDebounce();
  const callback = jest.fn(async () => 'value');
  const first = debounce('key', callback);
  const second = debounce('key', callback);
  expect(await first).toBe('value');
  expect(await second).toBe('value');
  expect(callback).toHaveBeenCalledTimes(1);
  expect(await debounce('key', callback)).toBe('value');
  expect(callback).toHaveBeenCalledTimes(2);
});
