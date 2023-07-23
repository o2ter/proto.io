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
import { request } from './request';
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
} from '../internals';

export class ProtoClientInternal<Ext> implements ProtoInternalType<Ext> {

  proto: ProtoClient<Ext>;
  options: ProtoOptions<Ext>;

  constructor(proto: ProtoClient<Ext>, options: ProtoOptions<Ext>) {
    this.proto = proto;
    this.options = options;
  }

  async request(
    data?: TSerializable,
    options?: RequestOptions & Parameters<typeof request>[0]
  ) {

    const { master, serializeOpts, ...opts } = options ?? {};

    const res = await request({
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
      .filter({ _id: object.objectId })
      .findOneAndUpdate(object[PVK].mutated);

    if (updated) {
      object[PVK].attributes = updated.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async createFile(object: TFile, options?: RequestOptions) {

    const { master, serializeOpts, ...opts } = options ?? {};
    const { data } = object[PVK].extra.data;

    let buffer: FileData;

    if (_.isString(data) || isFileBuffer(data) || isFileStream(data)) {
      buffer = data;
    } else if ('base64' in data) {
      buffer = Buffer.from(data.base64, 'base64');
    } else {
      throw Error('Invalid file object');
    }

    const res = await request({
      method: 'post',
      baseURL: this.options.endpoint,
      url: 'files',
      data: {
        attributes: serialize(_.fromPairs(object.keys().map(k => [k, object.get(k)])), serializeOpts),
        file: buffer,
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...opts
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


    return object;
  }

}
