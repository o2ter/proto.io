//
//  index.ts
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

import { request } from './request';
import axios from 'axios';
import { TSerializable, serialize, deserialize } from '../codec';
import { TQuery } from '../types/query';
import { queryMethods } from './query';
import { TObject } from '../types/object';
import { TExtensions, TObjectType, TObjectTypes } from '../types/object/types';
import { isObjKey } from '../utils';
import { objectMethods, applyObjectMethods } from '../types/object/methods';
import { RequestOptions } from './options';
import { PVK } from '../types/private';
import { ProtoType } from '../types/proto';
import { FileData } from '../types/object/file';
import { ExtraOptions } from '../types/options';

export * from '../common';

type ProtoOptions<Ext> = {
  endpoint: string;
  classExtends?: TExtensions<Ext>;
}

export const CancelTokenSource = axios.CancelToken.source;

export class Proto<Ext> implements ProtoType<Ext> {

  [PVK]: {
    options: ProtoOptions<Ext>;
  };

  constructor(options: ProtoOptions<Ext>) {
    this[PVK] = {
      options,
    };
  }

  Object<T extends string>(className: T): TObjectType<T, Ext> {
    const obj = isObjKey(className, TObjectTypes) ? new TObjectTypes[className] : new TObject(className);
    return objectMethods(obj as TObjectType<T, Ext>, this);
  }

  File(filename: string, data: FileData, type?: string) {
    const file = this.Object('_File');
    file.set('filename', filename);
    file.set('type', type);
    file[PVK].extra.data = data;
    return file;
  }

  Query<T extends string>(className: T, options?: RequestOptions): TQuery<T, Ext> {
    return queryMethods(new TQuery<T, Ext>(className), this, options);
  }

  async _request(
    data?: TSerializable,
    options?: RequestOptions & Parameters<typeof request>[0],
  ) {

    const { master, serializeOpts, ...opts } = options ?? {};

    const res = await request({
      baseURL: this[PVK].options.endpoint,
      data: serialize(data ?? null, serializeOpts),
      responseType: 'text',
      ...opts,
    });

    if (res.status !== 200) {
      const error = JSON.parse(res.data);
      throw new Error(error.message, { cause: error });
    }

    return applyObjectMethods<Ext>(deserialize(res.data), this);
  }

  async run(
    name: string,
    data?: TSerializable,
    options?: RequestOptions,
  ) {

    return this._request(data, {
      method: 'post',
      url: `functions/${name}`,
      ...(options ?? {})
    });
  }

  async _saveFile(object: TObject, options?: ExtraOptions) {


    return object;
  }

}

export default Proto;