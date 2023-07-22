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
import { TObject } from '../common/object';
import { ExtraOptions } from '../common/options';
import { defaultSchema } from './defaults';
import { ProtoInternalType } from '../common/proto';
import { Proto, ProtoOptions } from '.';

export class ProtoInternal<Ext> implements ProtoInternalType<Ext> {

  proto: Proto<Ext>;
  options: ProtoOptions<Ext>;

  constructor(proto: Proto<Ext>, options: ProtoOptions<Ext>) {
    this.proto = proto;
    this.options = options;
  }

  async prepare() {
    await this.options.storage.prepare(_.merge({}, defaultSchema, this.options.schema));
  }

  async run(name: string, payload: any, options?: ExtraOptions) {

    const func = this.options.functions?.[name];

    if (_.isNil(func)) return null;
    if (_.isFunction(func)) return func(payload ?? this.proto);

    const { callback, validator } = func;

    if (!!validator?.requireUser && !this.proto.user) throw new Error('No permission');
    if (!!validator?.requireMaster && !options?.master) throw new Error('No permission');
    if (!_.find(validator?.requireAnyUserRoles, x => _.includes(this.proto.roles, x))) throw new Error('No permission');
    if (_.find(validator?.requireAllUserRoles, x => !_.includes(this.proto.roles, x))) throw new Error('No permission');

    return _.isFunction(callback) ? callback(payload ?? this.proto) : null;
  }

  async saveFile(object: TObject, options?: ExtraOptions) {


    return object;
  }

}
