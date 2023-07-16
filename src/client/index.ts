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

import _ from 'lodash';
import { request } from './request';
import axios, { CancelToken } from 'axios';
import { IOSerializable, serialize, deserialize } from '../utils/codec';
import { Query } from '../utils/types/query';

export * from '../utils/codec';
export { PObject } from '../utils/types';

type Options = {
  endpoint: string;
}

export const CancelTokenSource = axios.CancelToken.source;

export class Proto {

  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  query(model: string): Query {
    const query = new Query(model);
    return query;
  }

  async run(
    name: string,
    data?: IOSerializable,
    options?: {
      cancelToken?: CancelToken
    },
  ) {

    const res = await request({
      method: 'post',
      url: `functions/${name}`,
      baseURL: this.options.endpoint,
      data: serialize(data ?? null),
      ...(options ?? {})
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw new Error(error.message, { cause: error });
    }

    return deserialize(res.data);
  }

}

export default Proto;