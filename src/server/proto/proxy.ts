//
//  proxy.ts
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

export const proxy = <T>(x: T): T => {
  const self = x as any;
  const proxy = _.create(self) as any;
  const _prototypes = (x: any): any[] => {
    const prototype = Object.getPrototypeOf(x);
    if (_.isNil(prototype) || prototype === Object.prototype) return [];
    return [prototype, ..._prototypes(prototype)];
  };
  const prototypes = _prototypes(proxy);
  for (const name of _.uniq(_.flatMap(prototypes, x => Object.getOwnPropertyNames(x)))) {
    if (name === 'constructor') continue;
    if (_.isFunction(self[name])) {
      proxy[name] = self[name].bind(self);
    } else {
      Object.defineProperty(proxy, name, { get: () => self[name] });
    }
  }
  return proxy;
};
