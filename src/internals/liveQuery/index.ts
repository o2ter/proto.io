//
//  index.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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
import { TQuerySelector } from '../query/types/selectors';
import { ProtoType } from '../proto';
import { TObjectType } from '../object/types';
import { PVK } from '../private';

export class LiveQuerySubscription<T extends string, E> {

  private _className: T;
  private _proto: ProtoType<E>;
  private _filter: TQuerySelector[];

  constructor(className: T, proto: ProtoType<E>, filter: TQuerySelector | TQuerySelector[]) {
    this._className = className;
    this._proto = proto;
    this._filter = _.isArray(filter) ? filter : [filter];
  }

  get className(): T {
    return this._className;
  }

  on(
    event: 'create' | 'update' | 'delete',
    callback: (object: TObjectType<T, E>) => void,
  ) {
    return this._proto[PVK].liveQuery(
      this._proto,
      event,
      this.className,
      this._filter,
      (object) => callback(object as TObjectType<T, E>),
    );
  }
}