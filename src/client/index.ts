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

import axios from 'axios';
import { TSerializable } from '../common/codec';
import { TQuery } from '../common/query';
import { queryMethods } from './query';
import { TObject } from '../common/object';
import { TExtensions, TObjectType, TObjectTypes } from '../common/object/types';
import { isObjKey } from '../common/utils';
import { objectMethods } from '../common/object/methods';
import { RequestOptions } from './options';
import { PVK } from '../common/private';
import { ProtoType } from '../common/proto';
import { FileData } from '../common/object/file';
import { ProtoInternal } from './internal';

export * from '../common';

export type ProtoOptions<Ext> = {
  endpoint: string;
  classExtends?: TExtensions<Ext>;
}

export const CancelTokenSource = axios.CancelToken.source;

export class Proto<Ext> implements ProtoType<Ext> {

  [PVK]: ProtoInternal<Ext>;

  constructor(options: ProtoOptions<Ext>) {
    this[PVK] = new ProtoInternal(this, options);
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

  async run(
    name: string,
    data?: TSerializable,
    options?: RequestOptions,
  ) {

    return this[PVK]._request(data, {
      method: 'post',
      url: `functions/${name}`,
      ...(options ?? {})
    });
  }

}

export default Proto;