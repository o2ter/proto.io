//
//  internal.ts
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
import { TSerializable, serialize, deserialize } from '../common/codec';
import { TObject } from '../common/object';
import { applyObjectMethods } from '../common/object/methods';
import { RequestOptions } from './options';
import { ProtoInternalType } from '../common/proto';
import { ExtraOptions } from '../common/options';
import { ProtoClient, ProtoOptions } from './index';

export class ProtoClientInternal<Ext> implements ProtoInternalType<Ext> {

  proto: ProtoClient<Ext>;
  options: ProtoOptions<Ext>;

  constructor(proto: ProtoClient<Ext>, options: ProtoOptions<Ext>) {
    this.proto = proto;
    this.options = options;
  }

  async request(
    data?: TSerializable,
    options?: RequestOptions & Parameters<typeof request>[0]
  ) {

    const { master, serializeOpts, ...opts } = options ?? {};

    const res = await request({
      baseURL: this.options.endpoint,
      data: serialize(data ?? null, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw new Error(error.message, { cause: error });
    }

    return applyObjectMethods<Ext>(deserialize(res.data), this.proto);
  }

  async saveFile(object: TObject, options?: ExtraOptions) {


    return object;
  }

}
