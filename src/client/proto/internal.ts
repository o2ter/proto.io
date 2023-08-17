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

import _ from 'lodash';
import Service from '../request';
import { RequestOptions } from '../options';
import { ProtoOptions } from './types';
import { ProtoClient } from '.';
import {
  PVK,
  applyObjectMethods,
  TSerializable,
  ProtoInternalType,
  TFile,
  ExtraOptions,
  deserialize,
  serialize,
  FileData,
  isFileBuffer,
  isFileStream,
  base64ToBuffer,
  TUser,
} from '../../internals';
import { iterableToStream, streamToIterable } from '../stream';
import { MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../internals/common/const';

export class ProtoClientInternal<Ext> implements ProtoInternalType<Ext> {

  proto: ProtoClient<Ext>;
  options: ProtoOptions<Ext>;

  service = new Service;

  constructor(proto: ProtoClient<Ext>, options: ProtoOptions<Ext>) {
    this.proto = proto;
    this.options = options;
  }

  async request(
    data?: TSerializable,
    options?: Parameters<Service['request']>[0]
  ) {

    const { serializeOpts, context, master, ...opts } = options ?? {};

    const res = await this.service.request({
      baseURL: this.options.endpoint,
      data: serialize(data ?? null, serializeOpts),
      responseType: 'text',
      headers: {
        ...master ? {
          [MASTER_USER_HEADER_NAME]: this.proto[PVK].options.masterUser?.user,
          [MASTER_PASS_HEADER_NAME]: this.proto[PVK].options.masterUser?.pass,
        } : {},
      },
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw Error(error.message, { cause: error });
    }

    return applyObjectMethods(deserialize(res.data), this.proto);
  }

  async currentUser(options?: RequestOptions) {

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

    const user = applyObjectMethods(deserialize(res.data), this.proto);
    if (!_.isNil(user) && !(user instanceof TUser)) throw Error('Unknown error');

    return user ?? undefined;
  }

  async logout(options?: RequestOptions) {

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

  async setPassword(user: TUser, password: string, options: RequestOptions & { master: true }) {

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

  async unsetPassword(user: TUser, options: RequestOptions & { master: true }) {

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

  async updateFile(object: TFile, options?: RequestOptions) {

    const updated = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .updateOne(object[PVK].mutated);

    if (updated) {
      object[PVK].attributes = updated.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async createFile(object: TFile, options?: RequestOptions) {

    const { serializeOpts, context, ...opts } = options ?? {};
    const { data } = object[PVK].extra;
    if (_.isNil(data)) throw Error('Invalid file object');

    let buffer: FileData;

    if (_.isString(data) || isFileBuffer(data) || isFileStream(data)) {
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
        attributes: serialize(_.fromPairs(object.keys().map(k => [k, object.get(k)])), serializeOpts),
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

  async saveFile(object: TFile, options?: RequestOptions) {
    return object.objectId ? this.updateFile(object, options) : this.createFile(object, options);
  }

  async deleteFile(object: TFile, options?: ExtraOptions) {

    const deleted = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .deleteOne();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  fileData(object: TFile, options?: RequestOptions | undefined) {

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
