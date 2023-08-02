//
//  compiler.ts
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
import { SqlDialect } from './dialect';
import { TSchema } from '../schema';
import { defaultObjectKeyTypes } from '../schema';
import { QuerySelector } from '../query/validator/parser';
import { DecodedBaseQuery } from '../storage';

export type QueryCompilerOptions = {
  className: string;
  filter?: QuerySelector;
  sort?: Record<string, 1 | -1>;
  includes: string[];
  matches: Record<string, DecodedBaseQuery>;
}

type Populate = {
  name: string;
  className: string;
  type: TSchema.Relation;
  foreignField?: string;
  subpaths: string[];
  filter: QuerySelector;
  includes: Record<string, { type: TSchema.DataType; name: string; }>;
  populates: Record<string, Populate>;
}

export class QueryCompiler {

  schema: Record<string, TSchema>;
  dialect: SqlDialect;

  idx = 0;
  includes: Record<string, { type: TSchema.DataType; name: string; }> = {};
  populates: Record<string, Populate> = {};
  sorting: Record<string, 1 | -1> = {};

  constructor(schema: Record<string, TSchema>, dialect: SqlDialect) {
    this.schema = schema;
    this.dialect = dialect;
  }

  nextIdx() {
    return this.idx++;
  }

  private _decodeIncludes(className: string, includes: string[], matches: Record<string, DecodedBaseQuery>) {

    const schema = this.schema[className] ?? {};
    const names: Record<string, { type: TSchema.DataType; name: string; }> = {};
    const populates: Record<string, Populate> = {};

    for (const include of includes) {
      const [colname, ...subpath] = include.split('.');

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      names[colname] = {
        type: dataType,
        name: `v${this.nextIdx()}`,
      };

      if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        populates[colname] = populates[colname] ?? {
          name: `t${this.nextIdx()}`,
          className: dataType.target,
          subpaths: [],
          matches: matches[colname].filter,
          ...dataType,
        };
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const [colname, populate] of _.toPairs(populates)) {
      const { includes, populates } = this._decodeIncludes(populate.className, populate.subpaths, matches[colname].matches);
      populate.includes = includes;
      populate.populates = populates;
    }

    return { includes: names, populates };
  }

  private _resolveSortingName(key: string) {
    let resolved: string | undefined;
    let includes = this.includes;
    let populates = this.populates;
    let resolvedField = false;
    for (const colname of _.toPath(key)) {
      const name = resolved ? `${resolved}.${colname}` : colname;
      if (resolvedField) {
        resolved = name;
      } else if (includes[name]) {
        resolved = includes[name].name;
        resolvedField = true;
      } else if (populates[name]) {
        resolved = populates[name].name;
        includes = populates[name].includes;
        populates = populates[name].populates;
      } else {
        throw Error(`Invalid path: ${key}`);
      }
    }
    return resolved;
  }

  private _decodeSorting(sort: Record<string, 1 | -1>) {
    for (const [key, order] of _.toPairs(sort)) {
      const resolved = this._resolveSortingName(key);
      if (!resolved) throw Error(`Invalid path: ${key}`);
      this.sorting[resolved] = order;
    }
  }

  compile(query: QueryCompilerOptions) {
    const { includes, populates } = this._decodeIncludes(query.className, query.includes, query.matches);
    this.includes = includes;
    this.populates = populates;
    if (query.sort) this._decodeSorting(query.sort);
  }
}