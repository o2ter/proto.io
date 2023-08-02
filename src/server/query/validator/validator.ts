//
//  validator.ts
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
import {
  PVK,
  TObject,
  TQuerySelector,
  isPrimitiveValue,
} from '../../../internals';
import { DecodedBaseQuery, DecodedQuery, ExplainOptions, FindOneOptions, FindOptions } from '../../storage';
import { CoditionalSelector, FieldSelector, QuerySelector } from './parser';
import { TSchema } from '../../schema';
import { Proto } from '../..';
import { TQueryBaseOptions } from '../../../internals/query/base';

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export class QueryValidator<E> {

  proto: Proto<E>
  acls: string[];
  master: boolean;

  static patterns = {
    path: /^[a-z_]\w*(\[\d+\]|\.\d*|\.[a-z_]\w*)*$/gi,
    name: /^[a-z_]\w*$/gi,
    digits: /^\d+$/g,
  }

  constructor(
    proto: Proto<E>,
    acls: string[],
    master: boolean,
  ) {
    this.proto = proto;
    this.acls = _.uniq(['*', ...acls]);
    this.master = master;
  }

  get schema() {
    return this.proto.schema;
  }

  get objectIdSize() {
    return this.proto[PVK].options.objectIdSize;
  }

  static recursiveCheck(...x: any[]) {
    recursiveCheck(x, []);
  }

  validateKeyPerm(
    key: string,
    type: keyof TSchema.FLPs,
    schema: TSchema,
  ) {
    if (type === 'read' && TObject.defaultKeys.includes(key)) return true;
    if (type !== 'read' && TObject.defaultReadonlyKeys.includes(key)) return false;
    return this.master || !_.every(schema.fieldLevelPermissions?.[key]?.[type] ?? ['*'], x => !_.includes(this.acls, x));
  }

  validateCLPs(
    className: string,
    ...keys: (keyof TSchema.CLPs)[]
  ) {
    if (!_.has(this.schema, className)) throw Error('No permission');
    if (this.master) return true;
    const perms = this.schema[className].classLevelPermissions ?? {};
    for (const key of keys) {
      if (_.every(perms[key] ?? ['*'], x => !_.includes(this.acls, x))) return false;
    }
    return true;
  }

  validateKey(
    className: string,
    key: string | string[],
    type: keyof TSchema.FLPs,
    validator: RegExp,
  ): boolean {

    const schema = this.schema[className] ?? {};
    const _key = _.isArray(key) ? key.join('.') : key;
    if (!_key.match(validator)) throw Error(`Invalid key: ${_key}`);

    const [colname, ...subpath] = _.toPath(_key);
    if (_.isEmpty(colname) || !_.has(schema.fields, colname)) throw Error(`Invalid path: ${_key}`);
    if (!this.validateKeyPerm(colname, type, schema)) return false;
    if (_.isEmpty(subpath) && TObject.defaultKeys.includes(colname)) return true;
    if (_.isEmpty(subpath)) return true;

    const dataType = schema.fields[colname];
    const isElem = _.first(subpath)?.match(QueryValidator.patterns.digits);
    if (isElem) {
      if (dataType === 'array') return true;
      if (!_.isString(dataType) && dataType.type !== 'relation') return false;
    }

    if (_.isString(dataType)) return true;
    if (dataType.type !== 'pointer' && dataType.type !== 'relation') return true;
    if (_.isNil(this.schema[dataType.target])) return false;
    if (type === 'read' && !this.validateCLPs(dataType.target, 'get')) return false;
    if (dataType.type === 'relation' && !_.isNil(dataType.foreignField)) {
      const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
      if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid path: ${_key}`);
      if (foreignField.type !== 'pointer' && foreignField.type !== 'relation') throw Error(`Invalid path: ${_key}`);
      if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid path: ${_key}`);
      if (!this.validateKeyPerm(dataType.foreignField, type, this.schema[dataType.target])) throw Error('No permission');
    }

    return this.validateKey(dataType.target, isElem ? subpath.slice(1) : subpath, type, validator);
  }

  validateFields<T extends Record<string, any>>(
    className: string,
    values: T,
    type: keyof TSchema.FLPs,
    validator: RegExp,
  ) {
    const _values = { ...values };
    for (const key of _.keys(_values)) {
      if (!this.validateKey(className, key, type, validator)) throw Error('No permission');
    }
    return _values;
  }

  decodeIncludes(className: string, includes: string[]): string[] {

    const schema = this.schema[className] ?? {};
    const primitive = _.keys(_.pickBy(schema.fields, v => _.isString(v) || (v.type !== 'pointer' && v.type !== 'relation')));

    const _includes: string[] = [];
    const populates: Record<string, { className: string; subpaths: string[]; }> = {};

    for (const include of includes) {
      if (include === '*') {
        _includes.push(..._.filter(primitive, k => this.validateKeyPerm(k, 'read', schema)));
      } else {
        const [colname, ...subpath] = include.split('.');
        if (_.isEmpty(colname) || !_.has(schema.fields, colname)) throw Error(`Invalid path: ${include}`);
        if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

        const dataType = schema.fields[colname];
        if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
          if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
          if (dataType.type === 'relation' && !_.isNil(dataType.foreignField)) {
            const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
            if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid path: ${include}`);
            if (foreignField.type !== 'pointer' && foreignField.type !== 'relation') throw Error(`Invalid path: ${include}`);
            if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid path: ${include}`);
            if (!this.validateKeyPerm(dataType.foreignField, 'read', this.schema[dataType.target])) throw Error('No permission');
          }
          populates[colname] = populates[colname] ?? { className: dataType.target, subpaths: [] };
          populates[colname].subpaths.push(_.isEmpty(subpath) ? '*' : subpath.join('.'));
        } else if (_.isEmpty(subpath)) {
          _includes.push(colname);
        } else {
          throw Error(`Invalid path: ${include}`);
        }
      }
    }

    for (const [key, populate] of _.toPairs(populates)) {
      const subpaths = this.decodeIncludes(populate.className, populate.subpaths);
      _includes.push(..._.map(subpaths, x => `${key}.${x}`));
    }

    _includes.push(...TObject.defaultKeys);
    return _.uniq(_includes);
  }

  decodeMatches(className: string, matches: Record<string, TQueryBaseOptions>): Record<string, DecodedBaseQuery> {

    const _matches: Record<string, DecodedBaseQuery> = {};

    const schema = this.schema[className] ?? {};
    for (const [colname, match] of _.toPairs(matches)) {
      if (_.isEmpty(colname) || !_.has(schema.fields, colname)) throw Error(`Invalid match: ${colname}`);
      if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

      const dataType = schema.fields[colname];
      if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
        if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
        if (dataType.type === 'relation' && !_.isNil(dataType.foreignField)) {
          const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
          if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid path: ${colname}`);
          if (foreignField.type !== 'pointer' && foreignField.type !== 'relation') throw Error(`Invalid path: ${colname}`);
          if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid path: ${colname}`);
          if (!this.validateKeyPerm(dataType.foreignField, 'read', this.schema[dataType.target])) throw Error('No permission');
        }
        _matches[colname] = {
          filter: QuerySelector.decode([
            ..._.castArray<TQuerySelector>(match.filter),
          ]),
          matches: this.decodeMatches(dataType.target, match.matches ?? {}),
        };
        if (
          !_matches[colname].filter.validate(key => this.validateKey(dataType.target, key, 'read', QueryValidator.patterns.path))
        ) throw Error('No permission');
      } else {
        throw Error(`Invalid match: ${colname}`);
      }
    }

    return _matches;
  }

  decodeQuery<Q extends ExplainOptions | FindOptions | FindOneOptions>(query: Q): DecodedQuery<Q> {

    const filter = QuerySelector.decode(query.filter ?? []).simplify();
    if (
      !filter.validate(key => this.validateKey(query.className, key, 'read', QueryValidator.patterns.path))
    ) throw Error('No permission');

    const includes = this.decodeIncludes(query.className, query.includes ?? ['*']);
    if (!_.every(_.keys(query.sort), k => includes.includes(k))) throw Error('Invalid sort keys');

    const matches = this.decodeMatches(query.className, query.matches ?? {});

    return {
      ..._.omit(query, 'filter', 'matches'),
      filter,
      matches,
      includes,
      acls: this.acls,
      master: this.master,
      objectIdSize: this.objectIdSize,
    };
  }

  isGetMethod(query: QuerySelector) {

    const objectIds = [];

    if (query instanceof CoditionalSelector && query.type === '$and') {
      for (const expr of query.exprs) {
        if (
          expr instanceof FieldSelector &&
          expr.field === '_id' &&
          expr.expr.type === '$eq'
        ) {
          if (!_.isString(expr.expr.value)) return false;
          objectIds.push(expr.expr.value);
        }
      }
    } else if (
      query instanceof FieldSelector &&
      query.field === '_id' &&
      query.expr.type === '$eq'
    ) {
      if (!_.isString(query.expr.value)) return false;
      objectIds.push(query.expr.value);
    }

    return _.uniq(objectIds).length === 1;
  }

}
