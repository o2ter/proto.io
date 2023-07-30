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

export type QueryCompilerOptions = DecodedQuery<ExplainOptions> | DecodedQuery<FindOptions> | DecodedQuery<FindOneOptions>;

export class QueryCompiler {

  schema: Record<string, TSchema>;
  query: QueryCompilerOptions;
  dialect: SqlDialect;

  idx = 0;
  names: Record<string, { type: TSchema.DataType; name: string; }> = {};
  populates: Record<string, { className: string; name: string; }> = {};

  constructor(schema: Record<string, TSchema>, query: QueryCompilerOptions, dialect: SqlDialect) {
    this.schema = schema;
    this.query = query;
    this.dialect = dialect;
  }

  get filter() {
    return this.query.filter;
  }

  get includes() {
    return this.query.includes;
  }

  get acls() {
    return this.query.acls;
  }

  get master() {
    return this.query.master;
  }

  nextIdx() {
    return this.idx++;
  }

  private _decodeIncludes(className: string, includes: string[], parent?: string) {

    const schema = this.schema[className] ?? {};
    const populates: Record<string, { className: string; type: TSchema.Relation; subpaths: string[]; }> = {};

    for (const include of includes) {
      const [colname, ...subpath] = include.split('.');

      const dataType = schema.fields[colname];
      if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
        if (_.isEmpty(subpath)) throw Error(`Invalid path: ${include}`);
        if (!populates[colname]) populates[colname] = { className: dataType.target, type: dataType.type, subpaths: [] };
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
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
      this.populates[parent ? `${parent}.${colname}` : colname] = { className: populate.className, name };
      this._decodeIncludes(populate.className, populate.subpaths, name);
    }
  }

  compile() {
    this._decodeIncludes(this.query.className, this.includes);
  }
}