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
import Service from './request';
import { RequestOptions } from './options';
import { ProtoClient, ProtoOptions } from './index';
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
} from '../internals';
import { iterableToStream, streamToIterable } from './stream';

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
    options?: Parameters<typeof this.service.request>[0]
  ) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = await this.service.request({
      baseURL: this.options.endpoint,
      data: serialize(data ?? null, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw new Error(error.message, { cause: error });
    }

    return applyObjectMethods(deserialize(res.data), this.proto);
  }

  async updateFile(object: TFile, options?: RequestOptions) {

    const updated = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .findOneAndUpdate(object[PVK].mutated);

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

    console.log(buffer)

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
      throw new Error(error.message, { cause: error });
    }

    const created = deserialize(res.data) as TFile;

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
      .findOneAndDelete();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  fileData(object: TFile, options?: RequestOptions | undefined) {

    const { serializeOpts, context, ...opts } = options ?? {};

    const res = this.service.request({
      method: 'get',
      baseURL: this.options.endpoint,
      url: `files/${object.objectId}/${object.filename}`,
      responseType: 'stream',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...opts,
    });

    return iterableToStream(res.then(x => {
      if (x.status >= 300) {
        const error = JSON.parse(x.data);
        throw new Error(error.message, { cause: error });
      }
      if (Symbol.asyncIterator in x.data || x.data instanceof ReadableStream) {
        return streamToIterable(x.data);
      } else {
        throw Error('Unknown stream type');
      }
    }));
  }
}
