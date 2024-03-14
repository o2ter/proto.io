//
//  proto.ts
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
import { PVK } from '../private';
import type { Request } from 'express';
import { ExtraOptions } from '../options';
import { TQuery } from '../query';
import { TExtensions, TObjectType, TObjectTypes } from '../object/types';
import { TFile } from '../object/file';
import { FileData, FileStream } from '../buffer';
import { isObjKey } from '../utils';
import { applyObjectMethods } from '../object/methods';
import { TValue, _TValue } from '../query/value';
import { TObject } from '../object';
import { TSerializable } from '../../common/codec';
import { TUser } from '../object/user';
import { ProtoFunction, ProtoFunctionOptions, ProtoTrigger } from './types';

export type TransactionMode = 'default' | 'committed' | 'repeatable' | 'serializable';

export type TransactionOptions = {
  mode?: TransactionMode;
  retry?: number | boolean;
};

export interface ProtoInternalType<Ext, P extends ProtoType<any>> {

  options: {
    endpoint: string;
    classExtends?: TExtensions<Ext>;
  };

  saveFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P>): Promise<TFile>;
  deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean, P>): Promise<TFile>;

  fileData(proto: P, object: TFile, options?: ExtraOptions<boolean, P>): FileStream;
}

export abstract class ProtoType<Ext> {

  abstract [PVK]: ProtoInternalType<Ext, this>;

  abstract config(): Promise<Record<string, _TValue>>;
  abstract setConfig(values: Record<string, _TValue>, options: { master: true; }): Promise<void>;

  abstract run(name: string, data?: TSerializable, options?: ExtraOptions<boolean, this>): Promise<void | TSerializable>
  abstract Query<T extends string>(className: T): TQuery<T, Ext, boolean, this>;

  rebind<T extends TSerializable | undefined>(object: T): T {
    return applyObjectMethods(object, this);
  }

  Object<T extends string>(className: T, objectId?: string): TObjectType<T, Ext> {
    const attrs: Record<string, TValue> = objectId ? { _id: objectId } : {};
    const obj = isObjKey(className, TObjectTypes) ? new TObjectTypes[className](attrs) : new TObject(className, attrs);
    return this.rebind(obj as TObjectType<T, Ext>);
  }

  File(filename: string, data: FileData, type?: string) {
    const file = this.Object('File');
    file.set('filename', filename);
    file.set('type', type);
    file[PVK].extra.data = data;
    return file;
  }

  async userRoles(user: TUser) {
    let queue = await this.Query('Role')
      .isIntersect('users', [user])
      .includes('users', 'name')
      .find({ master: true });
    let roles = queue;
    while (!_.isEmpty(queue)) {
      queue = await this.Query('Role')
        .isIntersect('roles', queue)
        .notContainsIn('_id', _.compact(_.map(roles, x => x.objectId)))
        .includes('roles', 'name')
        .find({ master: true });
      roles = _.uniqBy([...roles, ...queue], x => x.objectId);
    }
    return roles;
  }
};

export interface ProtoType<Ext> {

  connect<R extends Request, T extends object>(
    req: R,
    attrs?: T | ((x: this & { req: R; }) => T)
  ): this & { req: R; } & T;

  define(
    name: string,
    callback: ProtoFunction<Ext>,
    options?: Omit<ProtoFunctionOptions<Ext>, 'callback'>,
  ): void;

  beforeSave<T extends string>(name: T, callback: ProtoTrigger<T, Ext>): void;
  afterSave<T extends string>(name: T, callback: ProtoTrigger<T, Ext>): void;
  beforeDelete<T extends string>(name: T, callback: ProtoTrigger<T, Ext>): void;
  afterDelete<T extends string>(name: T, callback: ProtoTrigger<T, Ext>): void;
  beforeSaveFile(callback: ProtoTrigger<'File', Ext>): void;
  afterSaveFile(callback: ProtoTrigger<'File', Ext>): void;
  beforeDeleteFile(callback: ProtoTrigger<'File', Ext>): void;
  afterDeleteFile(callback: ProtoTrigger<'File', Ext>): void;

  lockTable(className: string | string[], update: boolean): void;

  withTransaction<T>(
    callback: (connection: ProtoType<Ext>) => PromiseLike<T>,
    options?: TransactionOptions,
  ): void;
};
