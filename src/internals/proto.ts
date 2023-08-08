//
//  proto.ts
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
import { PVK } from './private';
import { ExtraOptions } from './options';
import { TQuery } from './query';
import { TExtensions, TObjectType, TObjectTypes } from './object/types';
import { TFile } from './object/file';
import { FileData, FileStream } from './buffer';
import { isObjKey } from './utils';
import { applyObjectMethods } from './object/methods';
import { TValue } from './query/value';
import { TObject } from './object';
import { TSerializable } from './codec';
import { TUser } from './object/user';
import { TRole } from './object/role';

export interface ProtoInternalType<Ext> {

  options: {
    endpoint: string;
    classExtends?: TExtensions<Ext>;
  };

  saveFile(object: TFile, options?: ExtraOptions): Promise<TFile>;
  deleteFile(object: TFile, options?: ExtraOptions): Promise<TFile>;

  fileData(object: TFile, options?: ExtraOptions): FileStream;
}

export abstract class ProtoType<Ext> {

  abstract [PVK]: ProtoInternalType<Ext>;

  abstract run(name: string, data?: TSerializable, options?: ExtraOptions): Promise<TSerializable>
  abstract Query<T extends string>(className: T, options?: ExtraOptions): TQuery<T, Ext>;

  Object<T extends string>(className: T, objectId?: string): TObjectType<T, Ext> {
    const attrs: Record<string, TValue> = objectId ? { _id: objectId } : {};
    const obj = isObjKey(className, TObjectTypes) ? new TObjectTypes[className](attrs) : new TObject(className, attrs);
    return applyObjectMethods(obj as TObjectType<T, Ext>, this);
  }

  File(filename: string, data: FileData, type?: string) {
    const file = this.Object('File');
    file.set('filename', filename);
    file.set('type', type);
    file[PVK].extra.data = data;
    return file;
  }

  async userRoles(user: TUser) {
    let roles: TRole[] = [];
    let queue = await this.Query('Role', { master: true })
      .isIntersect('users', [user])
      .find();
    while (!_.isEmpty(queue)) {
      queue = await this.Query('Role', { master: true })
        .isIntersect('_roles', queue)
        .notContainsIn('_id', _.compact(_.map(roles, x => x.objectId)))
        .find();
      roles = _.uniqBy([...roles, ...queue], x => x.objectId);
    }
    return roles;
  }
};
