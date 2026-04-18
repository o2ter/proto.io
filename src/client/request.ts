//
//  request.ts
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

import _ from 'lodash';
import type { Readable } from 'node:stream';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  AUTH_COOKIE_KEY,
  AUTH_ALT_COOKIE_KEY,
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
import { deserialize } from '../internals/codec';
import { TObject } from '../internals/object';

export default class Service<Ext, P extends ProtoType<any>> {

  proto: ProtoClientInternal<Ext, P>;
  service: AxiosInstance;

  private token?: string;
  private sockets: Socket[] = [];

  private retryLimit?: number;
  private cookieKey?: string;

  constructor(proto: ProtoClientInternal<Ext, P>, { retryLimit, cookieKey, ...options }: AxiosOptions = {}) {
    this.proto = proto;
    this.service = axios.create({
      xsrfCookieName: XSRF_COOKIE_NAME,
      xsrfHeaderName: XSRF_HEADER_NAME,
      withCredentials: true,
      validateStatus: status => status >= 200 && status < 500,
      ...options,
    });
    this.retryLimit = retryLimit;
    this.cookieKey = cookieKey || AUTH_COOKIE_KEY;
  }

  refreshSocketSession() {
    for (const socket of this.sockets) {
      socket.emit('auth', this.token);
    }
  }

  setSessionToken(token?: string) {
    this.token = token;
    for (const socket of this.sockets) {
      socket.emit('auth', token);
    }
  }

  async _request<T extends unknown = any, D extends unknown = any>(
    config: RequestOptions<boolean> & AxiosRequestConfig<D>,
    retry = 0
  ): Promise<AxiosResponse<T, D>> {

    const { master, abortSignal, serializeOpts, headers, ...opts } = config ?? {};

    const res = await this.service.request({
      signal: abortSignal,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Cookie: this.token ? `${this.cookieKey}=${this.token}` : undefined,
        ...master ? {
          [MASTER_USER_HEADER_NAME]: this.proto.options.masterUser?.user,
          [MASTER_PASS_HEADER_NAME]: this.proto.options.masterUser?.pass,
        } : {},
        ...this.cookieKey && this.cookieKey !== AUTH_COOKIE_KEY ? {
          [AUTH_ALT_COOKIE_KEY]: this.cookieKey,
        } : {},
        ...headers,
      },
      responseType: 'text',
      ...opts,
    });

    if (res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      const pattern = `${this.cookieKey}=`;
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

  async request<T extends unknown = any, D extends unknown = any>(
    config: RequestOptions<boolean> & Omit<AxiosRequestConfig<D>, 'responseType' | 'adapter'>
  ) {
    return this._request<T, D>(config);
  }

  async _streamRequest<T extends unknown = any, D extends unknown = any>(
    config: RequestOptions<boolean> & AxiosRequestConfig<D>,
    retry = 0
  ): Promise<Readable | ReadableStream<Uint8Array>> {

    const { master, abortSignal, serializeOpts, headers, ...opts } = config ?? {};

    const isNodeJs = typeof process !== 'undefined' && process.versions && process.versions.node;
    const isFetchSupported = typeof fetch === 'function';

    if (isNodeJs || isFetchSupported) {

      const res = await this.service.request({
        signal: abortSignal,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Cookie: this.token ? `${this.cookieKey}=${this.token}` : undefined,
          ...master ? {
            [MASTER_USER_HEADER_NAME]: this.proto.options.masterUser?.user,
            [MASTER_PASS_HEADER_NAME]: this.proto.options.masterUser?.pass,
          } : {},
          ...this.cookieKey && this.cookieKey !== AUTH_COOKIE_KEY ? {
            [AUTH_ALT_COOKIE_KEY]: this.cookieKey,
          } : {},
          ...headers,
        },
        responseType: 'stream',
        adapter: isFetchSupported ? 'fetch' : undefined,
        ...opts,
      });

      if (res.headers['set-cookie']) {
        const cookies = res.headers['set-cookie'];
        const pattern = `${this.cookieKey}=`;
        const token = _.findLast(_.flatMap(cookies, x => x.split(';')), x => _.startsWith(x.trim(), pattern));
        this.setSessionToken(token?.trim().slice(pattern.length));
      }

      if (
        (this.retryLimit ? retry < this.retryLimit : true) &&
        _.includes([412, 429], res.status)
      ) {
        return this._streamRequest(config, retry + 1);
      }

      if (res.status !== 200) {
        let error: Error;
        try {
          // For streams, we need to read the content first
          let errorText = '';
          if (isFetchSupported && res.data instanceof ReadableStream) {
            const reader = res.data.getReader();
            const decoder = new TextDecoder();
            let done = false;
            while (!done) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) {
                errorText += decoder.decode(value, { stream: !done });
              }
            }
          } else {
            // Node.js stream.Readable
            const chunks: Buffer[] = [];
            for await (const chunk of res.data) {
              chunks.push(Buffer.from(chunk));
            }
            errorText = Buffer.concat(chunks).toString('utf-8');
          }
          const _error = JSON.parse(errorText);
          error = new Error(_error.message, { cause: _error });
        } catch {
          error = new Error('Request failed');
        }
        throw error;
      }

      return res.data;

    } else {
      // Fallback for environments without stream support (old browsers)
      // Use onDownloadProgress to receive data chunks
      return new ReadableStream({
        start: async (controller) => {
          let lastByteLength = 0;
          try {
            const res = await this.service.request({
              signal: abortSignal,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Cookie: this.token ? `${this.cookieKey}=${this.token}` : undefined,
                ...master ? {
                  [MASTER_USER_HEADER_NAME]: this.proto.options.masterUser?.user,
                  [MASTER_PASS_HEADER_NAME]: this.proto.options.masterUser?.pass,
                } : {},
                ...this.cookieKey && this.cookieKey !== AUTH_COOKIE_KEY ? {
                  [AUTH_ALT_COOKIE_KEY]: this.cookieKey,
                } : {},
                ...headers,
              },
              responseType: 'arraybuffer',
              onDownloadProgress: (progressEvent: any) => {
                // progressEvent.event.target.response contains the accumulated ArrayBuffer
                if (progressEvent.event && progressEvent.event.target) {
                  const response = progressEvent.event.target.response as ArrayBuffer;
                  if (response && response.byteLength > lastByteLength) {
                    // Only enqueue new bytes since last progress event
                    const newBytes = response.slice(lastByteLength);
                    controller.enqueue(new Uint8Array(newBytes));
                    lastByteLength = response.byteLength;
                  }
                }
              },
              ...opts,
            });

            if (res.headers['set-cookie']) {
              const cookies = res.headers['set-cookie'];
              const pattern = `${this.cookieKey}=`;
              const token = _.findLast(_.flatMap(cookies, x => x.split(';')), x => _.startsWith(x.trim(), pattern));
              this.setSessionToken(token?.trim().slice(pattern.length));
            }

            if (res.status !== 200) {
              let error: Error
              try {
                const decoder = new TextDecoder();
                const errorText = decoder.decode(res.data);
                const _error = JSON.parse(errorText);
                error = new Error(_error.message, { cause: _error });
              } catch {
                error = new Error('Request failed');
              }
              throw error;
            }

            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    }
  }

  async streamRequest<T extends unknown = any, D extends unknown = any>(
    config: RequestOptions<boolean> & Omit<AxiosRequestConfig<D>, 'responseType' | 'adapter'>,
  ) {
    return this._streamRequest<T, D>(config);
  }

  socket() {
    const endpoint = this.proto.options.socketEndpoint;
    const options = { auth: { token: this.token } };
    const socket = endpoint ? io(endpoint, options) : io(options);

    this.sockets.push(socket);

    type QueryOpts = {
      event: string;
      className: string;
      filter: TQuerySelector[];
    };

    let events: Record<string, {
      callback: (payload: any) => void;
      selector?: TQuerySelector;
    }> = {};
    let queries: Record<string, {
      callback: (payload: any) => void;
      options: QueryOpts;
    }> = {};
    let destroyCallbacks: VoidFunction[] = [];

    const register_event = () => {
      socket.emit('EV_NOTIFY', _.mapValues(events, x => x.selector ?? true));
    };

    const register_query = () => {
      socket.emit('EV_LIVEQUERY', _.mapValues(queries, x => x.options));
    };

    const register = () => {
      register_event();
      register_query();
    };

    socket.on('ON_EV_NOTIFY', ({ ids, data }: any) => {
      const payload = deserialize(JSON.stringify(data));
      for (const [id, { callback }] of _.entries(events)) {
        if (_.includes(ids, id)) callback(payload);
      }
    });

    socket.on('ON_EV_LIVEQUERY', ({ ids, data }: any) => {
      const objects = deserialize(JSON.stringify(data)) as TObject[];
      for (const [id, { callback }] of _.entries(queries)) {
        const keys = _.keys(_.pickBy(ids, v => _.includes(v, id)));
        callback(_.filter(objects, x => _.includes(keys, x.id)));
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
    const destroyIfNeed = () => {
      if (!_.isEmpty(events)) return;
      if (!_.isEmpty(queries)) return;
      destroy();
    };

    return {
      socket,
      listen: (callback: (payload: any) => void, selector?: TQuerySelector) => {
        const id = randomUUID();
        events[id] = { callback, selector };
        register_event();
        return () => {
          events = _.omit(events, id);
          register_event();
          destroyIfNeed();
        };
      },
      liveQuery: (callback: (payload: any) => void, options: QueryOpts) => {
        const id = randomUUID();
        queries[id] = { callback, options };
        register_query();
        return () => {
          queries = _.omit(queries, id);
          register_query();
          destroyIfNeed();
        };
      },
      onDestroy: (callback: VoidFunction) => {
        destroyCallbacks.push(callback);
      },
    };
  }
};
