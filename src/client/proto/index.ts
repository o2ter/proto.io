//
//  index.ts
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

import type { Request } from 'express';
import { ProtoClientQuery } from '../query';
import { RequestOptions } from '../options';
import { ProtoClientInternal } from './internal';
import {
  PVK,
  ProtoType, TQuery,
  TSerializable,
  TUser,
  _TValue
} from '../../internals';
import { ProtoOptions } from './types';

export class ProtoClient<Ext> extends ProtoType<Ext> {

  [PVK]: ProtoClientInternal<Ext, this>;

  constructor(options: ProtoOptions<Ext>) {
    super();
    this[PVK] = new ProtoClientInternal({ ...options });
  }

  Query<T extends string>(className: T): TQuery<T, Ext, boolean, this> {
    return new ProtoClientQuery<T, Ext>(className, this);
  }

  config(options?: RequestOptions<boolean, this>): Promise<Record<string, _TValue>> {
    return this[PVK].config(options);
  }
  async setConfig(values: Record<string, _TValue>, options: RequestOptions<true, this>) {
    if (options.master !== true) throw Error('No permission');
    await this[PVK].setConfig(values, options);
  }

  connect<R extends Request, T extends object>(): this & { req: R; } & T {
    throw Error('Invalid operation');
  }

  run(
    name: string,
    data?: TSerializable,
    options?: RequestOptions<boolean, this>
  ): Promise<void | TSerializable> {
    return this[PVK].request(this, data, {
      method: 'post',
      url: `functions/${name}`,
      ...(options ?? {})
    });
  }

  currentUser(options?: RequestOptions<boolean, this>) {
    return this[PVK].currentUser(this, options);
  }

  logout(options?: RequestOptions<boolean, this>) {
    return this[PVK].logout(options);
  }

  setPassword(user: TUser, password: string, options: RequestOptions<true, this>) {
    return this[PVK].setPassword(user, password, options);
  }

  unsetPassword(user: TUser, options: RequestOptions<true, this>) {
    return this[PVK].unsetPassword(user, options);
  }

  schema(options: RequestOptions<true, this>) {
    return this[PVK].schema(options);
  }

  define(): void {
    throw new Error('Invalid operation');
  }
  beforeSave(): void {
    throw new Error('Invalid operation');
  }
  afterSave(): void {
    throw new Error('Invalid operation');
  }
  beforeDelete(): void {
    throw new Error('Invalid operation');
  }
  afterDelete(): void {
    throw new Error('Invalid operation');
  }
  beforeSaveFile(): void {
    throw new Error('Invalid operation');
  }
  afterSaveFile(): void {
    throw new Error('Invalid operation');
  }
  beforeDeleteFile(): void {
    throw new Error('Invalid operation');
  }
  afterDeleteFile(): void {
    throw new Error('Invalid operation');
  }
  lockTable(): void {
    throw new Error('Invalid operation');
  }
  withTransaction(): void {
    throw new Error('Invalid operation');
  }
}
