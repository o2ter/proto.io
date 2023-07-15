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

import _ from 'lodash';

export namespace PQuery {

  export interface Filter {

  }

  export interface Options {
    filter?: PQuery.Filter;
    sort?: Record<string, number>;
    includes?: string[];
    skip?: number;
    limit?: number;
    returning?: 'old' | 'new';
  }
}

export class PQuery {

  model: string;
  options: PQuery.Options;

  constructor(model: string, options: PQuery.Options = {}) {
    this.model = model;
    this.options = options;
  }

  sort(sort: Record<string, number>) {
    this.options.sort = sort;
    return this;
  }

  includes(...includes: string[]) {
    this.options.includes = this.options.includes ? [...this.options.includes, ...includes] : includes;
    return this;
  }

  skip(skip: number) {
    this.options.skip = skip;
    return this;
  }

  limit(limit: number) {
    this.options.limit = limit;
    return this;
  }

  returning(returning: 'old' | 'new') {
    this.options.returning = returning;
    return this;
  }

}