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
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  AUTH_COOKIE_KEY,
  MASTER_PASS_HEADER_NAME,
  MASTER_USER_HEADER_NAME,
} from '../internals/const';
import { RequestOptions } from './options';
import { ProtoClientInternal } from './proto/internal';
import { ProtoType } from '../internals/proto';
import { AxiosOptions } from './proto/types';
import { XSRF_COOKIE_NAME, XSRF_HEADER_NAME } from '@o2ter/server-js/dist/const';
import { io } from 'socket.io-client';

export default class Service<Ext, P extends ProtoType<any>> {

  proto: ProtoClientInternal<Ext, P>;
  service: AxiosInstance;

  private token?: string;
  private sockets: ReturnType<typeof io>[] = [];

  constructor(proto: ProtoClientInternal<Ext, P>, options: AxiosOptions = {}) {
    this.proto = proto;
    this.service = axios.create({
      xsrfCookieName: XSRF_COOKIE_NAME,
      xsrfHeaderName: XSRF_HEADER_NAME,
      withCredentials: true,
      validateStatus: status => status >= 200 && status < 500,
      ...options,
    });
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

    if (res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      this.token = _.findLast(_.flatMap(cookies, x => x.split(';')), x => _.startsWith(x, `${AUTH_COOKIE_KEY}=`))
    }

    if (typeof window === 'undefined') {
      this.service.defaults.headers.Cookie = this.token ?? null;
    }

    if (res.status === 412) {
      return await this.service.request(config);
    }

    if (res.status !== 200) {
      let error: Error
      try {
        const _error = JSON.parse(res.data);
        error = new Error(_error.message, { cause: _error });
      } catch {
        error = new Error(res.data);
      }
      throw error;
    }

    return res;
  }

  socket() {
    const endpoint = this.proto.options.socketEndpoint;
    const options = { auth: { token: this.token } };
    const socket = endpoint ? io(endpoint, options) : io(options);

    this.sockets.push(socket);

    let disconnect = false;
    socket.on('connect_error', () => {
      if (!disconnect && !socket.active) socket.connect();
    });
    socket.on('disconnect', () => {
      if (!disconnect && !socket.active) socket.connect();
    });

    return {
      socket,
      disconnect: () => {
        disconnect = true;
        this.sockets = this.sockets.filter(x => x !== socket);
        socket.disconnect();
      },
    };
  }
};
