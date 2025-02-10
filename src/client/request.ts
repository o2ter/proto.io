//
//  request.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { io, Socket } from 'socket.io-client';
import { TQuerySelector } from '../internals/query/types/selectors';
import { randomUUID } from '@o2ter/crypto-js';

export default class Service<Ext, P extends ProtoType<any>> {

  proto: ProtoClientInternal<Ext, P>;
  service: AxiosInstance;

  private token?: string;
  private sockets: Socket[] = [];

  private retryLimit?: number;

  constructor(proto: ProtoClientInternal<Ext, P>, { retryLimit, ...options }: AxiosOptions = {}) {
    this.proto = proto;
    this.service = axios.create({
      xsrfCookieName: XSRF_COOKIE_NAME,
      xsrfHeaderName: XSRF_HEADER_NAME,
      withCredentials: true,
      validateStatus: status => status >= 200 && status < 500,
      ...options,
    });
    this.retryLimit = retryLimit;
  }

  setSessionToken(token?: string) {
    this.token = token;
    if (typeof window === 'undefined') {
      this.service.defaults.headers.Cookie = token ? `${AUTH_COOKIE_KEY}=${token}` : null;
    }
    for (const socket of this.sockets) {
      socket.emit('auth', token);
    }
  }

  async _request<T extends unknown = any, D extends unknown = any>(config: RequestOptions<boolean> & AxiosRequestConfig<D>, retry = 0): Promise<AxiosResponse<T, D>> {

    const { master, abortSignal, serializeOpts, headers, ...opts } = config ?? {};

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
      const pattern = `${AUTH_COOKIE_KEY}=`;
      const token = _.findLast(_.flatMap(cookies, x => x.split(';')), x => _.startsWith(x.trim(), pattern));
      this.setSessionToken(token?.trim().slice(pattern.length));
    }

    if (
      (this.retryLimit ? retry < this.retryLimit : true) &&
      _.includes([412, 429], res.status)
    ) {
      return this._request(config, retry + 1);
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

  async request<T extends unknown = any, D extends unknown = any>(config: RequestOptions<boolean> & AxiosRequestConfig<D>) {
    return this._request<T, D>(config);
  }

  socket() {
    const endpoint = this.proto.options.socketEndpoint;
    const options = { auth: { token: this.token } };
    const socket = endpoint ? io(endpoint, options) : io(options);

    this.sockets.push(socket);

    let listeners: Record<string, {
      callback: (payload: any) => void;
      selector?: TQuerySelector;
    }> = {};
    let destroyCallbacks: VoidFunction[] = [];

    const register = () => {
      socket.emit('register', _.mapValues(listeners, x => x.selector ?? true));
    };

    socket.on('data', ({ ids, data }: any) => {
      for (const [id, { callback }] of _.entries(listeners)) {
        if (_.includes(ids, id)) callback(data);
      }
    });

    socket.on('connect', register);
    socket.on('reconnect', register);

    const destroy = () => {
      this.sockets = this.sockets.filter(x => x !== socket);
      socket.disconnect();
      for (const callback of destroyCallbacks) {
        callback();
      }
    };

    return {
      socket,
      listen: (callback: (payload: any) => void, selector?: TQuerySelector) => {
        const id = randomUUID();
        listeners[id] = { callback, selector };
        register();
        return () => {
          listeners = _.omit(listeners, id);
          register();
          if (_.isEmpty(listeners)) destroy();
        };
      },
      onDestroy: (callback: VoidFunction) => {
        destroyCallbacks.push(callback);
      },
    };
  }
};
