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
import { TSchema, isPointer, isRelation } from '../schema';
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

export type Populate = {
  name: string;
  className: string;
  type: TSchema.Relation;
  foreignField?: { colname: string; type: TSchema.Relation; };
  subpaths: string[];
  filter: QuerySelector;
  includes: Record<string, TSchema.DataType>;
  populates: Record<string, Populate>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
}

export class QueryCompiler {

  schema: Record<string, TSchema>;

  idx = 0;
  includes: Record<string, TSchema.DataType> = {};
  populates: Record<string, Populate> = {};
  sorting: Record<string, 1 | -1> = {};

  constructor(schema: Record<string, TSchema>) {
    this.schema = schema;
  }

  nextIdx() {
    return this.idx++;
  }

  _decodeIncludes(className: string, includes: string[], matches: Record<string, DecodedBaseQuery>) {

    const schema = this.schema[className] ?? {};
    const names: Record<string, TSchema.DataType> = {};
    const populates: Record<string, Populate> = {};

    for (const include of includes) {
      const [colname, ...subpath] = include.split('.');

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      names[colname] = dataType;

      if (isPointer(dataType) || isRelation(dataType)) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        const _matches = matches[colname];
        populates[colname] = populates[colname] ?? {
          name: `t${this.nextIdx()}`,
          className: dataType.target,
          subpaths: [],
          matches: _matches.filter,
          skip: _matches.skip,
          limit: _matches.limit,
          type: dataType.type,
        };
        if (isRelation(dataType) && dataType.foreignField) {
          const targetType = this.schema[dataType.target].fields[dataType.foreignField];
          if (!isPointer(targetType) && !isRelation(targetType)) throw Error(`Invalid path: ${include}`);
          populates[colname].foreignField = {
            colname: dataType.foreignField,
            type: targetType.type,
          };
        }
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const [colname, populate] of _.toPairs(populates)) {
      const _matches = matches[colname];
      const { includes, populates } = this._decodeIncludes(populate.className, populate.subpaths, _matches.matches);
      populate.sort = this._decodeSorting(includes, populates, _matches.sort);
      populate.includes = includes;
      populate.populates = populates;
    }

    return { includes: names, populates };
  }

  private _resolveSortingName(
    key: string,
    includes: Record<string, TSchema.DataType>,
    populates: Record<string, Populate>,
  ) {
    let resolved: string | undefined;
    let resolvedField = false;
    for (const colname of _.toPath(key)) {
      const name = resolved ? `${resolved}.${colname}` : colname;
      if (resolvedField || includes[name]) {
        resolved = name;
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

  _decodeSorting(
    includes: Record<string, TSchema.DataType>,
    populates: Record<string, Populate>,
    sort?: Record<string, 1 | -1>,
  ) {
    const sorting: Record<string, 1 | -1> = {};
    for (const [key, order] of _.toPairs(sort)) {
      const resolved = this._resolveSortingName(key, includes, populates);
      if (!resolved) throw Error(`Invalid path: ${key}`);
      sorting[resolved] = order;
    }
    return sorting;
  }

  compile(query: QueryCompilerOptions) {
    const { includes, populates } = this._decodeIncludes(query.className, query.includes, query.matches);
    this.sorting = this._decodeSorting(includes, populates, query.sort);
    this.includes = includes;
    this.populates = populates;
  }
}