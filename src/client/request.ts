//
//  request.ts
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
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { XSRF_COOKIE_NAME, XSRF_HEADER_NAME } from '../server/csrf/const';
import { RequestOptions } from './options';

export default class {

  service = axios.create({ withCredentials: true });

  async request<T = any, D = any>(config: RequestOptions & AxiosRequestConfig<D>): Promise<AxiosResponse<T, D>> {

    const { master, abortSignal, serializeOpts, context, ...opts } = config ?? {};

    config = {
      xsrfCookieName: XSRF_COOKIE_NAME,
      xsrfHeaderName: XSRF_HEADER_NAME,
      validateStatus: status => status < 500,
      signal: abortSignal,
      ...opts,
    };
  
    const res = await this.service.request(config);
  
    if (res.status === 412) {
      return await this.service.request(config);
    }
  
    return res;
  }
};
