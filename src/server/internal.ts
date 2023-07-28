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
import { Readable } from 'node:stream';
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
  base64ToBuffer,
  generateId,
} from '../internals';

export class ProtoInternal<Ext> implements ProtoInternalType<Ext> {

  proto: Proto<Ext>;
  options: Required<ProtoOptions<Ext>>;

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

  constructor(proto: Proto<Ext>, options: Required<ProtoOptions<Ext>>) {
    if (!_.isNil(options.schema['_Schema'])) throw Error('Reserved name of class');
    this.proto = proto;
    this.options = {
      ...options,
      schema: _.merge({}, defaultSchema, options.fileStorage.schema, options.schema),
    };
    this.functions = {};
    this.triggers = {};
  }

  async prepare() {
    await this.options.storage.prepare(this.options.schema);
  }

  generateId() {
    return generateId(this.options.objectIdSize);
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
      .equalTo('_id', object.objectId)
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
    if (_.isNil(data)) throw Error('Invalid file object');

    let file: { _id: string; size: number; } | undefined;
    let content: string | undefined;

    const info = {
      mimeType: object.get('type') as string,
      filename: object.get('filename') as string,
    };

    if (_.isString(data) && data.length < 64 * 1024) {
      content = data;
    } else if (_.isString(data) || isFileBuffer(data) || isFileStream(data)) {
      file = await this.proto.fileStorage.create(this.proto, data, info);
    } else if ('base64' in data) {
      const buffer = base64ToBuffer(data.base64);
      file = await this.proto.fileStorage.create(this.proto, buffer, info);
    } else if ('_id' in data && 'size' in data) {
      file = data;
    } else {
      throw Error('Invalid file object');
    }

    try {

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

    } catch (e) {

      if (file?._id) this.destoryFileData(this.proto, file._id);

      throw e;
    }
  }

  async saveFile(object: TFile, options?: ExtraOptions) {

    const beforeSave = this.triggers?.beforeSaveFile;
    const afterSave = this.triggers?.afterSaveFile;

    const context = options?.context ?? {};

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

    object = await object.fetchIfNeeded(['token'], options);
    const context = options?.context ?? {};

    if (_.isFunction(beforeDelete)) {
      await beforeDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    const deleted = await this.proto.Query(object.className, options)
      .equalTo('_id', object.objectId)
      .findOneAndDelete();

    if (deleted) {
      object[PVK].attributes = deleted.attributes;
      object[PVK].mutated = {};
      object[PVK].extra = {};
    }

    this.destoryFileData(this.proto, object.token);

    if (_.isFunction(afterDelete)) {
      await afterDelete(Object.setPrototypeOf({ object, context }, this.proto));
    }

    return object;
  }

  fileData(object: TFile, options?: ExtraOptions) {
    const self = this;
    return Readable.from({
      [Symbol.asyncIterator]: async function*() {
        object = await object.fetchIfNeeded(['token'], options);
        const chunks = self.options.fileStorage.fileData(self.proto, object.token);
        for await(const chunk of chunks) yield chunk;
      }
    });
  }

  destoryFileData(proto: Proto<Ext>, id: string) {
    (async () => {
      try {
        await this.proto.fileStorage.destory(this.proto, id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

}
