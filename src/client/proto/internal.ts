//
//  internal.ts
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
import Service from '../request';
import { RequestOptions } from '../options';
import { ProtoOptions } from './types';
import { TSchema } from '../../internals/schema';
import { asyncStream, base64ToBuffer, isBinaryData, isBlob, isReadableStream, iterableToStream } from '@o2ter/utils-js';
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
      responseType: 'text',
      ...opts,
    });

    return proto.rebind(deserialize(res.data));
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
      responseType: 'text',
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
      responseType: 'text',
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
      responseType: 'text',
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
      responseType: 'text',
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
      responseType: 'text',
      ...opts,
    });
  }

  async logout(options?: RequestOptions<boolean>) {

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'user/logout',
      responseType: 'text',
      ...opts,
    });
  }

  async setPassword(user: TUser, password: string, options: RequestOptions<true>) {

    if (!user.objectId) throw Error('Invalid user');
    if (_.isEmpty(password)) throw Error('Invalid password');

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.objectId}/password`,
      data: serialize({ password }, serializeOpts),
      responseType: 'text',
      ...opts,
    });
  }

  async unsetPassword(user: TUser, options: RequestOptions<true>) {

    if (!user.objectId) throw Error('Invalid user');

    const { serializeOpts, ...opts } = options ?? {};

    await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.objectId}/password`,
      responseType: 'text',
      ...opts,
    });
  }

  async schema(options: RequestOptions<true>): Promise<Record<string, TSchema>> {

    const { serializeOpts, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'schema',
      responseType: 'text',
      ...opts,
    });

    return deserialize(res.data) as any;
  }

  async updateFile(proto: P, object: TFile, options?: RequestOptions<boolean>) {

    const updated = await proto.Query(object.className)
      .equalTo('_id', object.objectId)
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
      responseType: 'text',
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
    return object.objectId ? this.updateFile(proto, object, options) : this.createFile(proto, object, options);
  }

  async deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean>) {

    const deleted = await proto.Query(object.className)
      .equalTo('_id', object.objectId)
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

    return iterableToStream(async () => {
      const res = await this.service.request({
        method: 'get',
        baseURL: this.options.endpoint,
        url: `files/${object.objectId}/${encodeURIComponent(filename)}`,
        responseType: 'stream',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        ...opts,
      });

      if (Symbol.asyncIterator in res.data) {
        return res.data;
      } else {
        throw Error('Unknown stream type');
      }
    });
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
      responseType: 'text',
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
    if (!object.objectId) throw Error('Invalid object');
    const request = async () => {
      const { serializeOpts, ...opts } = options ?? {};
      const res = await this.service.request({
        method: 'get',
        baseURL: this.options.endpoint,
        url: `classes/${encodeURIComponent(object.className)}/${object.objectId}/refs`,
        serializeOpts: {
          objAttrs: TObject.defaultReadonlyKeys,
        },
        responseType: 'text',
        ...opts,
      });
      return proto.rebind(deserialize(res.data)) as TObjectType<string, Ext>[];
    }
    return asyncStream(request);
  }
}
