//
//  internal.ts
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
import Service from '../request';
import { RequestOptions } from '../options';
import { ProtoOptions } from './types';
import { TSchema } from '../../internals/schema';
import { asyncStream, base64ToBuffer, bufferToString, isBinaryData, isBlob, isReadableStream, iterableToStream } from '@o2ter/utils-js';
import { TSerializable, deserialize, serialize } from '../../internals/codec';
import { EventData, ProtoInternalType, ProtoType } from '../../internals/proto';
import { TObjectType } from '../../internals/object/types';
import { TUser } from '../../internals/object/user';
import { TValueWithoutObject } from '../../internals/types';
import { TFile } from '../../internals/object/file';
import { PVK } from '../../internals/private';
import { FileData } from '../../internals/buffer';
import { ExtraOptions } from '../../internals/options';
import { UPLOAD_TOKEN_HEADER_NAME } from '../../internals/const';
import { TObject } from '../../internals/object';
import { TQuerySelector } from '../../internals/query/types/selectors';

const readableStreamToAsyncIterable = (stream: Readable | ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> => {
  if (typeof ReadableStream !== 'undefined' && stream instanceof ReadableStream) {
    return (async function* () {
      const reader = stream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    })();
  } else {
    return stream;
  }
}

export class ProtoClientInternal<Ext, P extends ProtoType<any>> implements ProtoInternalType<Ext, P> {

  options: ProtoOptions<Ext>;
  service: Service<Ext, P>;

  socket?: ReturnType<Service<Ext, P>['socket']>;

  constructor(options: ProtoOptions<Ext>) {
    this.options = options;
    this.service = new Service(this, options.axiosOptions);
  }
  
  async request(
    proto: P,
    data?: TSerializable,
    options?: Parameters<Service<Ext, P>['request']>[0]
  ) {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      baseURL: this.options.endpoint,
      data: serialize(data, serializeOpts),
      ...opts,
    });

    return proto.rebind(deserialize(res.data));
  }

  async run<R extends TSerializable | AsyncIterable<TSerializable> | void = any>(
    proto: P,
    name: string,
    data?: TSerializable,
    options?: RequestOptions<boolean>
  ) {
    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.streamRequest({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `functions/${encodeURIComponent(name)}`,
      data: serialize(data, serializeOpts),
      ...opts,
    });

    let buffer = '';
    let isStreaming = false;
    const iterator = readableStreamToAsyncIterable(res)[Symbol.asyncIterator]();

    // Collect chunks until we determine if it's streaming or not
    while (!isStreaming) {
      const { value, done } = await iterator.next();
      if (done) break;

      buffer += bufferToString(value);
      if (buffer.includes('\n')) {
        isStreaming = true;
      }
    }

    if (!isStreaming) {
      // No newline found - single value response
      return proto.rebind(deserialize(buffer)) as R;
    }

    // Streaming response - return async generator
    return (async function* () {
      // Process buffered data first
      let lines = buffer.split('\n');
      let remainder = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line && line !== '[' && line !== ']') {
          const json = line.startsWith('[') || line.startsWith(',') ? line.substring(1) : line;
          if (json) {
            yield proto.rebind(deserialize(json));
          }
        }
      }

      // Continue processing remaining stream chunks
      while (true) {
        const { value, done } = await iterator.next();
        if (done) break;

        remainder += bufferToString(value);
        const parts = remainder.split('\n');
        remainder = parts[parts.length - 1];

        for (let i = 0; i < parts.length - 1; i++) {
          const line = parts[i].trim();
          if (line && line !== ']') {
            const json = line.startsWith(',') ? line.substring(1) : line;
            if (json) {
              yield proto.rebind(deserialize(json));
            }
          }
        }
      }

      // Handle final remainder - should be ']' or error
      if (remainder.trim() && remainder.trim() !== ']') {
        let error: Error
        try {
          const _error = JSON.parse(remainder);
          error = new Error(_error.message, { cause: _error });
        } catch {
          error = new Error(remainder);
        }
        throw error;
      }
    })() as AsyncIterable<TSerializable> as R;
  }

  refreshSocketSession() {
    this.service.refreshSocketSession();
  }

  setSessionToken(proto: P, token?: string) {
    this.service.setSessionToken(token);
  }

  async sessionInfo(
    proto: P,
    options?: RequestOptions<boolean>
  ) {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'sessionInfo',
      ...opts,
    });

    return proto.rebind(deserialize(res.data));
  }

  async currentUser(
    proto: P,
    options?: RequestOptions<boolean>
  ): Promise<TObjectType<'User', Ext> | undefined> {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'user/me',
      ...opts,
    });

    const user = proto.rebind(deserialize(res.data)) as TObjectType<'User', Ext>;
    if (!_.isNil(user) && !(user instanceof TUser)) throw Error('Unknown error');

    return user ?? undefined;
  }

  async config(options?: RequestOptions<boolean>) {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'config',
      ...opts,
    });

    return deserialize(res.data) as Record<string, TValueWithoutObject>;
  }
  async configAcl(options: RequestOptions<boolean>) {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'configAcl',
      ...opts,
    });

    return deserialize(res.data) as Record<string, string[]>;
  }
  async setConfig(values: Record<string, TValueWithoutObject>, options: RequestOptions<boolean> & { acl?: string[]; }) {

    const { serializeOpts, acl, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'config',
      data: serialize({ values, acl }, serializeOpts),
      ...opts,
    });
  }

  async logout(options?: RequestOptions<boolean>) {

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'user/logout',
      ...opts,
    });
  }

  async setPassword(user: TUser, password: string, options: RequestOptions<true>) {

    if (!user.id) throw Error('Invalid user');
    if (_.isEmpty(password)) throw Error('Invalid password');

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.id}/password`,
      data: serialize({ password }, serializeOpts),
      ...opts,
    });
  }

  async unsetPassword(user: TUser, options: RequestOptions<true>) {

    if (!user.id) throw Error('Invalid user');

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.id}/password`,
      ...opts,
    });
  }

  async schema(options: RequestOptions<true>): Promise<Record<string, TSchema>> {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'schema',
      ...opts,
    });

    return deserialize(res.data) as any;
  }

  async updateFile(proto: P, object: TFile, options?: RequestOptions<boolean>) {

    const updated = await proto.Query(object.className)
      .equalTo('_id', object.id)
      .includes(...object.keys())
      .updateOne(object[PVK].mutated, options);

    if (updated) {
      object[PVK].attributes = updated.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async createFile(proto: P, object: TFile, options?: RequestOptions<boolean> & { uploadToken?: string; }) {

    const { serializeOpts, uploadToken, ...opts } = options ?? {};
    const { data } = object[PVK].extra;
    if (_.isNil(data)) throw Error('Invalid file object');

    let buffer: FileData;

    if (_.isString(data) || isBinaryData(data) || isReadableStream(data) || isBlob(data)) {
      buffer = data;
    } else if ('base64' in data) {
      buffer = base64ToBuffer(data.base64);
    } else {
      throw Error('Invalid file object');
    }

    const res = await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'files',
      data: {
        attributes: serialize(_.fromPairs([...object._set_entries()]), serializeOpts),
        file: buffer,
      },
      headers: {
        'Content-Type': 'multipart/form-data',
        [UPLOAD_TOKEN_HEADER_NAME]: uploadToken,
      },
      ...opts,
    });

    const created = deserialize(res.data);
    if (!_.isNil(created) && !(created instanceof TFile)) throw Error('Unknown error');

    if (created) {
      object[PVK].attributes = created.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async saveFile(proto: P, object: TFile, options?: RequestOptions<boolean>) {
    return object.id ? this.updateFile(proto, object, options) : this.createFile(proto, object, options);
  }

  async deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean>) {

    const deleted = await proto.Query(object.className)
      .equalTo('_id', object.id)
      .deleteOne(options);

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  fileData(proto: P, object: TFile, options?: RequestOptions<boolean>) {

    const { serializeOpts, ...opts } = options ?? {};

    const filename = object.filename;
    if (_.isNil(filename)) throw Error('Invalid filename');

    return iterableToStream(async () => this.service.streamRequest({
      method: 'get',
      baseURL: this.options.endpoint,
      url: `files/${object.id}/${encodeURIComponent(filename)}`,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...opts,
    }));
  }

  async notify(
    proto: P,
    data: Record<string, TValueWithoutObject> & { _rperm?: string[]; },
    options?: RequestOptions<boolean>
  ) {

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'notify',
      data: serialize(data, serializeOpts),
      ...opts,
    });
  }

  listen(proto: P, callback: (data: EventData) => void, selector?: TQuerySelector) {
    const _socket = this.socket ?? this.service.socket();
    const { socket, listen, onDestroy } = _socket;
    if (_.isNil(this.socket)) {
      this.socket = _socket;
      onDestroy(() => { this.socket = undefined; });
    }
    return {
      socket,
      remove: listen((payload) => {
        callback(payload);
      }, selector),
    };
  }

  liveQuery(
    proto: P,
    event: string,
    className: string,
    filter: TQuerySelector[],
    callback: (object: TObject) => void,
  ) {
    const _socket = this.socket ?? this.service.socket();
    const { socket, liveQuery, onDestroy } = _socket;
    if (_.isNil(this.socket)) {
      this.socket = _socket;
      onDestroy(() => { this.socket = undefined; });
    }
    return {
      socket,
      remove: liveQuery((objects) => {
        for (const object of proto.rebind(objects)) {
          (async () => {
            try {
              await callback(object);
            } catch (e) {
              proto.logger.error(e);
            }
          })();
        }
      }, { event, className, filter }),
    };
  }

  refs(proto: P, object: TObject, options?: RequestOptions<boolean>) {
    if (!object.id) throw Error('Invalid object');
    const request = async () => {
      const { serializeOpts, ...opts } = options ?? {};
      const res = await this.service.request({
        method: 'get',
        baseURL: this.options.endpoint,
        url: `classes/${encodeURIComponent(object.className)}/${object.id}/refs`,
        serializeOpts: {
          objAttrs: TObject.defaultReadonlyKeys,
        },
        ...opts,
      });
      return proto.rebind(deserialize(res.data)) as TObjectType<string, Ext>[];
    }
    return asyncStream(request);
  }
}
