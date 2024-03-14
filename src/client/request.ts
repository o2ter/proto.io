//
//  request.ts
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
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  AUTH_COOKIE_KEY,
  MASTER_PASS_HEADER_NAME,
  MASTER_USER_HEADER_NAME,
  XSRF_COOKIE_NAME,
  XSRF_HEADER_NAME,
} from '../internals/const';
import { RequestOptions } from './options';
import { ProtoClientInternal } from './proto/internal';
import { ProtoType } from '../internals/proto';

export default class Service<Ext, P extends ProtoType<any>> {

  service = axios.create({
    xsrfCookieName: XSRF_COOKIE_NAME,
    xsrfHeaderName: XSRF_HEADER_NAME,
    validateStatus: status => status >= 200 && status < 500,
    withCredentials: true,
  });

  proto: ProtoClientInternal<Ext, P>;

  constructor(proto: ProtoClientInternal<Ext, P>) {
    this.proto = proto;
  }

  async request<T = any, D = any>(config: RequestOptions<boolean, P> & AxiosRequestConfig<D>): Promise<AxiosResponse<T, D>> {

    const { master, abortSignal, serializeOpts, context, headers, ...opts } = config ?? {};

    const res = await this.service.request({
      signal: abortSignal,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...master ? {
          [MASTER_USER_HEADER_NAME]: this.proto.options.masterUser?.user,
          [MASTER_PASS_HEADER_NAME]: this.proto.options.masterUser?.pass,
        } : {},
        ...headers,
      },
      ...opts,
    });

    if (typeof window === 'undefined' && res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      const token = _.findLast(_.flatMap(cookies, x => x.split(';')), x => _.startsWith(x, `${AUTH_COOKIE_KEY}=`))
      if (token) this.service.defaults.headers.Cookie = token;
    }

    if (res.status === 412) {
      return await this.service.request(config);
    }

    return res;
  }
};
