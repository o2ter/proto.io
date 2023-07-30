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
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions } from '../storage';
import { SqlDialect } from './dialect';
import { TSchema } from '../schema';
import { defaultObjectKeyTypes } from '../schema';

export type QueryCompilerOptions = DecodedQuery<ExplainOptions> | DecodedQuery<FindOptions> | DecodedQuery<FindOneOptions>;

export class QueryCompiler {

  schema: Record<string, TSchema>;
  query: QueryCompilerOptions;
  dialect: SqlDialect;

  idx = 0;
  names: Record<string, { type: TSchema.DataType; name: string; }> = {};
  populates: Record<string, { className: string; name: string; }> = {};
  sorting: Record<string, 1 | -1> = {};

  constructor(schema: Record<string, TSchema>, query: QueryCompilerOptions, dialect: SqlDialect) {
    this.schema = schema;
    this.query = query;
    this.dialect = dialect;
  }

  nextIdx() {
    return this.idx++;
  }

  private _decodeIncludes(className: string, includes: string[], parent?: string) {

    const schema = this.schema[className] ?? {};
    const populates: Record<string, { className: string; type: TSchema.Relation; subpaths: string[]; }> = {};

    for (const include of includes) {
      const [colname, ...subpath] = include.split('.');

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        if (!populates[colname]) populates[colname] = { className: dataType.target, type: dataType.type, subpaths: [] };
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (_.isEmpty(subpath)) {
        this.names[parent ? `${parent}.${colname}` : colname] = {
          type: dataType,
          name: `v${this.nextIdx()}`,
        };
      } else {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const [colname, populate] of _.toPairs(populates)) {
      const name = `t${this.nextIdx()}`;
      const path = parent ? `${parent}.${colname}` : colname;
      this.populates[populate.type === 'relation' ? `${path}.*` : path] = { className: populate.className, name };
      this._decodeIncludes(populate.className, populate.subpaths, name);
    }
  }

  private _resolveName(key: string) {
    let resolved: string | undefined;
    for (const colname of key.split('.')) {
      const name = resolved ? `${resolved}.${colname}` : colname;
      const found = this.populates[name] ?? this.populates[`${name}.*`] ?? this.names[name];
      if (!found) throw Error(`Invalid path: ${key}`);
      resolved = found.name;
    }
    return resolved;
  }

  private _decodeSorting() {
    const sorting = this.query.sort ?? {};
    for (const [key, order] of _.toPairs(sorting)) {
      const resolved = this._resolveName(key);
      if (!resolved) throw Error(`Invalid path: ${key}`);
      this.sorting[resolved] = order;
    }
  }

  compile() {
    this._decodeIncludes(this.query.className, this.query.includes);
    this._decodeSorting();
  }
}