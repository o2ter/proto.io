//
//  methods.ts
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

import _ from 'lodash';
import { Query } from './index';
import { PStorage } from '../storage';
import { PObject } from '../object';

declare module './index' {
  export interface Query {
    then: Promise<PObject>['then']
    [Symbol.asyncIterator]: AsyncIterator<PObject>;
  }
}

export const queryMethods = (query: Query, storage: PStorage, acls: string[]) => {

  const _find = () => storage.find({
    acls,
    model: query.model,
    ...query.options,
  });

  const props = {
    [Symbol.asyncIterator]: {
      get() {
        return _find()[Symbol.asyncIterator];
      },
    },
    then: {
      get() {
        return new Promise<PObject[]>(async (resolve, reject) => {
          try {
            const result: PObject[] = [];
            for await (const obj of _find()) {
              result.push(obj)
            }
            resolve(result);
          } catch (e) {
            reject(e);
          }
        }).then;
      },
    }
  };

  Object.defineProperties(query, props);
}
