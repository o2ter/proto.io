//
//  index.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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

import { ProtoClientQuery, ProtoClientRelationQuery } from '../query';
import { RequestOptions } from '../options';
import { ProtoClientInternal } from './internal';
import { ProtoOptions } from './types';
import { TSerializable } from '../../internals/codec';
import { EventData, ProtoType } from '../../internals/proto';
import { TQuery } from '../../internals/query';
import { PVK } from '../../internals/private';
import { TValueWithoutObject } from '../../internals/types';
import { TUser } from '../../internals/object/user';
import { TObject } from '../../internals/object';
import { PathName } from '../../internals/query/types';
import { TQuerySelector } from '../../internals/query/types/selectors';

export class ProtoClient<Ext = any> extends ProtoType<Ext> {

  /** @internal */
  [PVK]: ProtoClientInternal<Ext, this>;

  constructor(options: ProtoOptions<Ext>) {
    super();
    this[PVK] = new ProtoClientInternal({ ...options });
  }

  Query<T extends string>(className: T): TQuery<T, Ext, boolean> {
    return new ProtoClientQuery<T, Ext>(className, this, {});
  }

  Relation<T extends string>(object: TObject, key: PathName<T>): TQuery<string, Ext, boolean> {
    const id = object.id;
    if (!id) throw Error('Invalid object');
    return new ProtoClientRelationQuery<Ext>(this, {
      relatedBy: {
        className: object.className,
        id,
        key,
      },
    });
  }

  config(options?: RequestOptions<boolean>): Promise<Record<string, TValueWithoutObject>> {
    return this[PVK].config(options);
  }
  configAcl(options: RequestOptions<true>) {
    if (options.master !== true) throw Error('No permission');
    return this[PVK].configAcl(options);
  }
  async setConfig(values: Record<string, TValueWithoutObject>, options: RequestOptions<true> & { acl?: string[]; }) {
    if (options.master !== true) throw Error('No permission');
    await this[PVK].setConfig(values, options);
  }

  run<R extends TSerializable | void = any>(
    name: string,
    data?: TSerializable,
    options?: RequestOptions<boolean>
  ) {
    return this[PVK].request(this, data, {
      method: 'post',
      url: `functions/${encodeURIComponent(name)}`,
      ...(options ?? {})
    }) as Promise<R>;
  }

  scheduleJob(
    name: string,
    data?: TValueWithoutObject,
    options?: RequestOptions<boolean>
  ) {
    return this[PVK].request(this, data, {
      method: 'post',
      url: `jobs/${encodeURIComponent(name)}`,
      ...(options ?? {})
    }) as any;
  }

  refreshSocketSession() {
    this[PVK].refreshSocketSession();
  }

  setSessionToken(token?: string) {
    this[PVK].setSessionToken(this, token);
  }

  sessionInfo(options?: RequestOptions<boolean>) {
    return this[PVK].sessionInfo(this, options);
  }

  currentUser(options?: RequestOptions<boolean>) {
    return this[PVK].currentUser(this, options);
  }

  logout(options?: RequestOptions<boolean>) {
    return this[PVK].logout(options);
  }

  setPassword(user: TUser, password: string, options: RequestOptions<true>) {
    return this[PVK].setPassword(user, password, options);
  }

  unsetPassword(user: TUser, options: RequestOptions<true>) {
    return this[PVK].unsetPassword(user, options);
  }

  schema(options: RequestOptions<true>) {
    return this[PVK].schema(options);
  }

  notify(data: Record<string, TValueWithoutObject> & { _rperm?: string[]; }, options?: RequestOptions<boolean>) {
    return this[PVK].notify(this, data, options);
  }

  listen(
    callback: (data: EventData) => void,
    selector?: TQuerySelector
  ) {
    return this[PVK].listen(this, callback, selector);
  }

  refs(object: TObject, options?: RequestOptions<boolean>) {
    return this[PVK].refs(this, object, options);
  }
}
