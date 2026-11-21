//
//  debounce.ts
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

export const createCacheDebounce = (timeout?: number) => {
  const cacheMap = new Map<string, {
    promise: Promise<unknown>;
    settled: boolean;
    timer?: ReturnType<typeof setTimeout>;
  }>();
  return <T>(
    key: string,
    callback: (key: string) => Promise<T>,
  ): Promise<T> => {
    let entry = cacheMap.get(key);
    const refresh = (item: NonNullable<typeof entry>) => {
      if (item.timer !== undefined) clearTimeout(item.timer);
      item.timer = setTimeout(() => {
        if (cacheMap.get(key) === item) cacheMap.delete(key);
      }, timeout);
    };
    if (!entry) {
      const promise = (async () => callback(key))();
      const item = { promise, settled: false };
      entry = item;
      cacheMap.set(key, item);
      void promise.then(() => {
        item.settled = true;
        if (timeout) refresh(item);
        else cacheMap.delete(key);
      }, () => {
        cacheMap.delete(key);
      });
    } else if (entry.settled && timeout) {
      refresh(entry);
    }
    return entry.promise as Promise<T>;
  };
}
