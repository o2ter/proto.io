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
import { CoditionalSelector, FieldExpression, FieldSelector, QuerySelector } from '../query/validator/parser';
import { SQL, sql } from './sql';

export type QueryCompilerOptions = {
  className: string;
  filter?: QuerySelector;
  sort?: Record<string, 1 | -1>;
  includes: string[];
}

type Populate = {
  name: string;
  className: string;
  type: TSchema.Relation;
  foreignField?: string;
  subpaths: string[];
  includes: Record<string, { type: TSchema.DataType; name: string; }>;
  populates: Record<string, Populate>;
}

export class QueryCompiler {

  schema: Record<string, TSchema>;
  query: QueryCompilerOptions;
  dialect: SqlDialect;

  idx = 0;
  includes: Record<string, { type: TSchema.DataType; name: string; }> = {};
  populates: Record<string, Populate> = {};
  sorting: Record<string, 1 | -1> = {};

  filter?: SQL;

  constructor(schema: Record<string, TSchema>, query: QueryCompilerOptions, dialect: SqlDialect) {
    this.schema = schema;
    this.query = query;
    this.dialect = dialect;
  }

  nextIdx() {
    return this.idx++;
  }

  private _decodeIncludes(className: string, includes: string[]) {

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
          ...dataType,
        };
        populates[colname].subpaths.push(subpath.join('.'));
      } else if (!_.isEmpty(subpath)) {
        throw Error(`Invalid path: ${include}`);
      }
    }

    for (const populate of _.values(populates)) {
      const { includes, populates } = this._decodeIncludes(populate.className, populate.subpaths);
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

  private _decodeSorting() {
    for (const [key, order] of _.toPairs(this.query.sort)) {
      const resolved = this._resolveSortingName(key);
      if (!resolved) throw Error(`Invalid path: ${key}`);
      this.sorting[resolved] = order;
    }
  }

  private _decodeCoditionalSelector(filter: CoditionalSelector) {
    const queries = _.compact(_.map(filter.exprs, x => this._decodeFilter(x)));
    if (_.isEmpty(queries)) return;
    switch (filter.type) {
      case '$and': return sql`${{ literal: _.map(queries, x => sql`(${x})`), separator: ' AND ' }}`;
      case '$nor': return sql`${{ literal: _.map(queries, x => sql`NOT (${x})`), separator: ' AND ' }}`;
      case '$or': return sql`${{ literal: _.map(queries, x => sql`(${x})`), separator: ' OR ' }}`;
    }
  }

  private _decodeFieldExpression(field: string, expr: FieldExpression) {

  }

  private _decodeFilter(filter: QuerySelector): SQL | undefined {
    if (filter instanceof CoditionalSelector) {
      return this._decodeCoditionalSelector(filter);
    }
    if (filter instanceof FieldSelector) {
      const [colname, ...subpath] = _.toPath(filter.field);

    }
  }

  compile() {
    const { includes, populates } = this._decodeIncludes(this.query.className, this.query.includes);
    this.includes = includes;
    this.populates = populates;
    if (this.query.sort) this._decodeSorting();
    if (this.query.filter) this.filter = this._decodeFilter(this.query.filter);
  }
}