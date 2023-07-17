//
//  object.ts
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
import { privateKey } from './private';

enum UpdateOperation {
  set,
  increment,
  multiply,
  max,
  min,
  push,
  removeAll,
  popFirst,
  popLast,
}

export interface IOObject {
  save: (master?: boolean) => PromiseLike<void>;
  destory: (master?: boolean) => PromiseLike<void>;
}

export class IOObject {

  [privateKey]: {
    className: string;  
    attributes: Record<string, any>;
    mutated: Record<string, [UpdateOperation, any]>;
  };

  constructor(
    className: string,
    attributes?: Record<string, any> | ((self: IOObject) => Record<string, any>),
  ) {
    this[privateKey] = {
      className,
      attributes: _.isFunction(attributes) ? attributes(this) : attributes ?? {},
      mutated: {},
    }
  }

  get className(): string {
    return this[privateKey].className;
  }

  get attributes(): Record<string, any> {
    return this[privateKey].attributes;
  }

  get objectId(): string | undefined {
    return this[privateKey].attributes._id;
  }

  get createdAt(): Date | undefined {
    return this[privateKey].attributes._created_at;
  }

  get updatedAt(): Date | undefined {
    return this[privateKey].attributes._updated_at;
  }

  keys(): string[] {
    return _.uniq([..._.keys(this.attributes), ..._.keys(this[privateKey].mutated)]);
  }

  get(key: string): any {
    if (_.isNil(this[privateKey].mutated[key])) return this.attributes[key];
    const [op, value] = this[privateKey].mutated[key];
    return op === UpdateOperation.set ? value : this.attributes[key];
  }

  set(key: string, value: any) {
    this[privateKey].mutated[key] = [UpdateOperation.set, value];
  }

  get isDirty(): boolean {
    return !_.isEmpty(this[privateKey].mutated);
  }
}
