//
//  internal.ts
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
import Service from '../request';
import { RequestOptions } from '../options';
import { ProtoOptions } from './types';
import {
  PVK,
  TSerializable,
  ProtoInternalType,
  TFile,
  ExtraOptions,
  deserialize,
  serialize,
  FileData,
  isBinaryData,
  isFileStream,
  base64ToBuffer,
  TUser,
  isBlob,
  _TValue,
  TObjectType,
  ProtoType,
} from '../../internals';
import { iterableToStream, streamToIterable } from '../stream';
import { TSchema } from '../../internals/schema';

export class ProtoClientInternal<Ext, P extends ProtoType<any>> implements ProtoInternalType<Ext, P> {

  options: ProtoOptions<Ext>;

  service = new Service(this);

  constructor(options: ProtoOptions<Ext>) {
    this.options = options;
  }

  async request(
    proto: P,
    data?: TSerializable,
    options?: Parameters<Service<Ext, P>['request']>[0]
  ) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      baseURL: this.options.endpoint,
      data: serialize(data, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    return proto.rebind(deserialize(res.data));
  }

  async currentUser(
    proto: P,
    options?: RequestOptions<boolean, P>
  ): Promise<TObjectType<'User', Ext> | undefined> {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'user/me',
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    const user = proto.rebind(deserialize(res.data)) as TObjectType<'User', Ext>;
    if (!_.isNil(user) && !(user instanceof TUser)) throw Error('Unknown error');

    return user ?? undefined;
  }

  async config(options?: RequestOptions<boolean, P>) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'config',
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    return deserialize(res.data) as Record<string, _TValue>;
  }
  async setConfig(values: Record<string, _TValue>, options: RequestOptions<boolean, P>) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'config',
      data: serialize(values, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }
  }

  async logout(options?: RequestOptions<boolean, P>) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'user/logout',
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }
  }

  async setPassword(user: TUser, password: string, options: RequestOptions<true, P>) {

    if (!user.objectId) throw Error('Invalid user');
    if (_.isEmpty(password)) throw Error('Invalid password');

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.objectId}/password`,
      data: serialize({ password }, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }
  }

  async unsetPassword(user: TUser, options: RequestOptions<true, P>) {

    if (!user.objectId) throw Error('Invalid user');

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: `user/${user.objectId}/password`,
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }
  }

  async schema(options: RequestOptions<true, P>): Promise<Record<string, TSchema>> {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: 'schema',
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    return deserialize(res.data) as any;
  }

  async updateFile(proto: P, object: TFile, options?: RequestOptions<boolean, P>) {

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

  async createFile(proto: P, object: TFile, options?: RequestOptions<boolean, P>) {

    const { serializeOpts, context, ...opts } = options ?? {};
    const { data } = object[PVK].extra;
    if (_.isNil(data)) throw Error('Invalid file object');

    let buffer: FileData;

    if (_.isString(data) || isBinaryData(data) || isFileStream(data) || isBlob(data)) {
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
        attributes: serialize(_.fromPairs([...object.entries()]), serializeOpts),
        file: buffer,
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    const created = deserialize(res.data);
    if (!_.isNil(created) && !(created instanceof TFile)) throw Error('Unknown error');

    if (created) {
      object[PVK].attributes = created.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async saveFile(proto: P, object: TFile, options?: RequestOptions<boolean, P>) {
    return object.objectId ? this.updateFile(proto, object, options) : this.createFile(proto, object, options);
  }

  async deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean, any>) {

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

  fileData(proto: P, object: TFile, options?: RequestOptions<boolean, P>) {

    const { serializeOpts, context, ...opts } = options ?? {};

    return iterableToStream(async () => {
      const res = await this.service.request({
        method: 'get',
        baseURL: this.options.endpoint,
        url: `files/${object.objectId}/${object.filename}`,
        responseType: 'stream',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        ...opts,
      });

      if (res.status !== 200) {
        const error = JSON.parse(res.data);
        throw Error(error.message, { cause: error });
      }
      if (Symbol.asyncIterator in res.data || res.data instanceof ReadableStream) {
        return streamToIterable(res.data);
      } else {
        throw Error('Unknown stream type');
      }
    });
  }
}
