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
import { defaultSchema } from './defaults';
import { Proto, ProtoOptions, ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from './index';
import {
  PVK,
  TFile,
  ExtraOptions,
  ProtoInternalType,
  FileData,
  isFileBuffer,
  isFileStream,
} from '../internals';

export class ProtoInternal<Ext> implements ProtoInternalType<Ext> {

  proto: Proto<Ext>;
  options: ProtoOptions<Ext>;

  functions: Record<string, ProtoFunction<Ext> | ProtoFunctionOptions<Ext>>;
  triggers: {
    beforeSave?: Record<string, ProtoTrigger<string, Ext>>;
    afterSave?: Record<string, ProtoTrigger<string, Ext>>;
    beforeDelete?: Record<string, ProtoTrigger<string, Ext>>;
    afterDelete?: Record<string, ProtoTrigger<string, Ext>>;
    beforeSaveFile?: ProtoTrigger<'_File', Ext>;
    afterSaveFile?: ProtoTrigger<'_File', Ext>;
    beforeDeleteFile?: ProtoTrigger<'_File', Ext>;
    afterDeleteFile?: ProtoTrigger<'_File', Ext>;
  };

  constructor(proto: Proto<Ext>, options: ProtoOptions<Ext>) {
    this.proto = proto;
    this.options = options;
    this.functions = {};
    this.triggers = {};
  }

  async prepare() {
    await this.options.storage.prepare(_.merge({}, defaultSchema, this.options.schema));
  }

  async run(name: string, payload: any, options?: ExtraOptions) {

    const func = this.functions?.[name];

    if (_.isNil(func)) throw new Error('Function not found');
    if (_.isFunction(func)) return func(payload ?? this.proto);

    const { callback, validator } = func;

    if (!!validator?.requireUser && !this.proto.user) throw new Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw new Error('No permission');
    if (!_.find(validator?.requireAnyUserRoles, x => _.includes(this.proto.roles, x))) throw new Error('No permission');
    if (_.find(validator?.requireAllUserRoles, x => !_.includes(this.proto.roles, x))) throw new Error('No permission');

    return callback(payload ?? this.proto);
  }

  async updateFile(object: TFile, options?: ExtraOptions) {

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

  async createFile(object: TFile, options?: ExtraOptions) {

    const data = object[PVK].extra.data as FileData | { _id: string; size: number; };

    let file: { _id?: string; size?: number; persist?: boolean; } = {};
    let content: string | undefined;

    const info = {
      mimeType: object.get('type'),
      filename: object.get('filename'),
    };

    if (_.isString(data) && data.length < 64 * 1024) {
      content = data;
    } else if (_.isString(data) || isFileBuffer(data) || isFileStream(data)) {
      file = await this.proto.fileStorage.create(this.proto, data, info);
    } else if ('base64' in data) {
      const buffer = Buffer.from(data.base64, 'base64');
      file = await this.proto.fileStorage.create(this.proto, buffer, info);
    } else if ('_id' in data && 'size' in data) {
      file = { ...data, persist: true };
    } else {
      throw Error('Invalid file object');
    }

    if (!file?.persist && file?._id) {
      await this.proto.fileStorage.persist(this.proto, file?._id);
    }

    if (file?._id) {
      object.set('token', file._id);
      object.set('size', file.size);
    } else if (content) {
      object.set('content', content);
      object.set('size', content.length);
    }

    const created = await this.proto.Query(object.className, options)
      .insert(_.fromPairs(object.keys().map(k => [k, object.get(k)])));

    if (created) {
      object[PVK].attributes = created.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    return object;
  }

  async saveFile(object: TFile, options?: ExtraOptions) {

    const beforeSave = this.triggers?.beforeSaveFile;
    const afterSave = this.triggers?.afterSaveFile;

    const context = {};

    if (_.isFunction(beforeSave)) {
      await beforeSave(Object.setPrototypeOf({ object, context }, this.proto));
    }

    if (object.objectId) {
      object = await this.updateFile(object, options);
    } else {
      object = await this.createFile(object, options);
    }

    if (_.isFunction(afterSave)) {
      await afterSave(Object.setPrototypeOf({ object, context }, this.proto));
    }

    return object;
  }

  async deleteFile(object: TFile, options?: ExtraOptions) {

    const beforeDelete = this.triggers?.beforeDeleteFile;
    const afterDelete = this.triggers?.afterDeleteFile;

    const context = {};

    if (_.isFunction(beforeDelete)) {
      await beforeDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    if (_.isFunction(afterDelete)) {
      await afterDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    return object;
  }

}
