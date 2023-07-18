//
//  index.ts
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

import { request } from './request';
import axios, { CancelToken } from 'axios';
import { IOSerializable, serialize, deserialize } from '../codec';
import { Query } from '../types/query';
import { queryMethods } from './query';
import { IOObject } from '../types/object';
import { IOObjectType, IOObjectTypes } from '../types/object/types';
import { ExtraOptions } from '../types/options';
import { isObjKey } from '../utils';
import { objectMethods, applyIOObjectMethods } from '../types/object/methods';

export * from '../codec';

type Options = {
  endpoint: string;
}

export const CancelTokenSource = axios.CancelToken.source;

type RequestOptions = {
  master?: boolean;
  cancelToken?: CancelToken;
};

export class Proto {

  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  object<T extends string>(className: T) {
    const obj = isObjKey(className, IOObjectTypes) ? new IOObjectTypes[className] : new IOObject(className);
    return objectMethods(obj, this) as IOObjectType<T>;
  }

  query(className: string, options?: ExtraOptions): Query {
    return queryMethods(new Query(className), this, options);
  }

  async _request(
    data?: IOSerializable,
    options?: RequestOptions & Parameters<typeof request>[0]
  ) {

    const { master, ...opts } = options ?? {};

    const res = await request({
      baseURL: this.options.endpoint,
      data: serialize(data ?? null),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw new Error(error.message, { cause: error });
    }

    return applyIOObjectMethods(deserialize(res.data), this);
  }

  async run(
    name: string,
    data?: IOSerializable,
    options?: RequestOptions,
  ) {

    return this._request(data, {
      method: 'post',
      url: `functions/${name}`,
      ...(options ?? {})
    });
  }

}

export default Proto;