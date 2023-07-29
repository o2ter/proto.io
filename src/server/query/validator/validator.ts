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
  TObject,
  isPrimitiveValue,
} from '../../../internals';
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions } from '../../storage';
import { QuerySelector } from './parser';
import { TSchema } from '../../schema';

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export class QueryValidator {

  schema: Record<string, TSchema>;
  acls: string[];

  static patterns = {
    queryPath: /^[a-z_]\w*(\[\*\]|\.\*|\[\d+\]|\.\d*|\.[a-z_]\w*)*$/gi,
    path: /^[a-z_]\w*(\[\d+\]|\.\d*|\.[a-z_]\w*)*$/gi,
    name: /^[a-z_]\w*$/gi,
    digits: /^\d+$/g,
  };

  constructor(
    schema: Record<string, TSchema>,
    acls: string[],
  ) {
    this.schema = schema;
    this.acls = _.uniq(['*', ...acls]);
  }

  static recursiveCheck(...x: any[]) {
    recursiveCheck(x, []);
  }

  validatePerm(
    key: string,
    type: keyof TSchema.ACLs,
    perms: Record<string, TSchema.ACLs> | undefined,
  ) {
    if (type === 'read' && TObject.defaultKeys.includes(key)) return true;
    if (type !== 'read' && TObject.defaultReadonlyKeys.includes(key)) return false;
    return !_.every(perms?.[key]?.[type] ?? ['*'], x => !_.includes(this.acls, x));
  }

  validateCLPs(
    className: string,
    ...keys: (keyof TSchema.CLPs)[]
  ) {
    if (!_.has(this.schema, className)) throw new Error('No permission');
    const perms = this.schema[className].classLevelPermissions ?? {};
    for (const key of keys) {
      if (_.every(perms[key] ?? ['*'], x => !_.includes(this.acls, x))) return false;
    }
    return true;
  }

  validateKey(
    className: string,
    key: string | string[],
    type: keyof TSchema.ACLs,
    validator: RegExp,
  ): boolean {

    const schema = this.schema[className] ?? {};
    const _key = _.isArray(key) ? key.join('.') : key;
    if (!_key.match(validator)) throw Error(`Invalid key: ${_key}`);

    const [root, ...subpath] = _.toPath(_key);
    if (_.isEmpty(root) || !_.has(schema.fields, root)) throw Error(`Invalid path: ${_key}`);
    if (!this.validatePerm(root, type, schema.fieldLevelPermissions)) return false;
    if (_.isEmpty(subpath)) return true;

    const dataType = schema.fields[root];
    const isElem = _.first(subpath) === '*' || _.first(subpath)?.match(QueryValidator.patterns.digits);
    if (isElem) {
      if (dataType === 'array') return true;
      if (!_.isString(dataType) && dataType.type !== 'relation') return false;
    }

    if (_.isString(dataType)) return true;
    if (dataType.type !== 'pointer' && dataType.type !== 'relation') return true;
    if (_.isNil(this.schema[dataType.target])) return false;

    return this.validateKey(dataType.target, isElem ? subpath.slice(1) : subpath, type, validator);
  };

  validateFields<T extends Record<string, any>>(
    className: string,
    values: T,
    type: keyof TSchema.ACLs,
    validator: RegExp,
  ) {
    const _values = { ...values };
    for (const key of _.keys(_values)) {
      if (!this.validateKey(className, key, type, validator)) throw new Error('No permission');
    }
    return _values;
  }

  #decodeIncludes(className: string, includes: string[]): string[] {

    const schema = this.schema[className] ?? {};
    const primitive = _.keys(_.filter(schema.fields, v => _.isString(v) || (v.type !== 'pointer' && v.type !== 'relation')));

    const _includes: string[] = [];
    const populates: Record<string, { className: string; subpaths: string[]; }> = {};

    for (const include of includes) {
      if (include === '*') {
        _includes.push(..._.filter(primitive, k => this.validatePerm(k, 'read', schema.fieldLevelPermissions)));
      } else {
        const [root, ...subpath] = include.split('.');
        if (_.isEmpty(root) || !_.has(schema.fields, root)) throw Error(`Invalid path: ${include}`);
        if (!this.validatePerm(root, 'read', schema.fieldLevelPermissions)) throw new Error('No permission');

        const dataType = schema.fields[root];
        if (!_.isString(dataType) && (dataType.type === 'pointer' || dataType.type === 'relation')) {
          if (!populates[root]) populates[root] = { className: dataType.target, subpaths: [] };
          populates[root].subpaths.push(_.isEmpty(subpath) ? '*' : subpath.join('.'));
        } else if (!_.isEmpty(subpath)) {
          _includes.push(root);
        } else {
          throw Error(`Invalid path: ${include}`);
        }
      }
    }

    for (const [key, populate] of _.toPairs(populates)) {
      const subpaths = this.#decodeIncludes(populate.className, populate.subpaths);
      _includes.push(..._.map(subpaths, x => `${key}.${x}`));
    }

    _includes.push(...TObject.defaultKeys);
    return _.uniq(_includes);
  }

  decodeQuery<Q extends ExplainOptions | FindOptions | FindOneOptions>(query: Q): DecodedQuery<Q> {

    const filter = QuerySelector.decode(query.filter ?? []).simplify();
    if (
      !filter.validate(key => this.validateKey(query.className, key, 'read', QueryValidator.patterns.queryPath))
    ) throw new Error('No permission');

    const includes = this.#decodeIncludes(query.className, query.includes ?? ['*']);
    if (!_.every(_.keys(query.sort), k => includes.includes(k))) throw new Error(`Invalid sort keys`);

    return { ...query, filter, includes };
  };

}
