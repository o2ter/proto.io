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
import { DecodedBaseQuery, DecodedQuery, FindOptions, FindOneOptions } from '../../storage';
import { CoditionalSelector, FieldSelector, QuerySelector } from './parser';
import { TSchema, defaultObjectKeyTypes, isPointer, isPrimitive, isRelation } from '../../schema';
import { ProtoService } from '../../proto';
import { TQueryBaseOptions } from '../../../internals/query/base';

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export class QueryValidator<E> {

  proto: ProtoService<E>
  acls: string[];
  master: boolean;
  disableSecurity: boolean;

  static patterns = {
    path: /^[a-z_]\w*(\[\d+\]|\.\d*|\.[a-z_]\w*)*$/gi,
    name: /^[a-z_]\w*$/gi,
    digits: /^\d+$/g,
  }

  constructor(
    proto: ProtoService<E>,
    acls: string[],
    master: boolean,
    disableSecurity: boolean,
  ) {
    this.proto = proto;
    this.acls = _.uniq(['*', ...acls]);
    this.master = master;
    this.disableSecurity = disableSecurity;
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
    if (_.isEmpty(key) || (!_.has(schema.fields, key) && !TObject.defaultKeys.includes(key))) throw Error(`Invalid key: ${key}`);
    if (type === 'read' && TObject.defaultKeys.includes(key)) return true;
    if (type !== 'read' && TObject.defaultReadonlyKeys.includes(key)) return false;
    if (!this.disableSecurity && _.includes(schema.secureFields, key)) return false;
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
    if (!this.validateKeyPerm(colname, type, schema)) return false;
    if (_.isEmpty(subpath) && TObject.defaultKeys.includes(colname)) return true;
    if (_.isEmpty(subpath)) return true;

    const dataType = schema.fields[colname];
    const isElem = _.first(subpath)?.match(QueryValidator.patterns.digits);
    if (isElem) {
      if (dataType === 'array') return true;
      if (!_.isString(dataType) && dataType.type !== 'relation') return false;
    }

    if (isPrimitive(dataType)) return true;
    if (_.isNil(this.schema[dataType.target])) return false;
    if (type === 'read' && !this.validateCLPs(dataType.target, 'get')) return false;
    if (dataType.type === 'relation' && !_.isNil(dataType.foreignField)) {
      const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
      if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid key: ${_key}`);
      if (isPrimitive(foreignField)) throw Error(`Invalid key: ${_key}`);
      if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid key: ${_key}`);
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
    const primitive = _.keys(_.pickBy(schema.fields, v => isPrimitive(v)));

    const _includes: string[] = [];
    const populates: Record<string, { className: string; subpaths: string[]; }> = {};

    for (const include of includes) {
      if (include === '*') {
        _includes.push(..._.filter(primitive, k => this.validateKeyPerm(k, 'read', schema)));
      } else {
        const [colname, ...subpath] = include.split('.');
        if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

        const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
        if (isPointer(dataType) || isRelation(dataType)) {
          if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
          if (dataType.type === 'relation' && !_.isNil(dataType.foreignField)) {
            const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
            if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid include: ${include}`);
            if (isPrimitive(foreignField)) throw Error(`Invalid include: ${include}`);
            if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid include: ${include}`);
            if (!this.validateKeyPerm(dataType.foreignField, 'read', this.schema[dataType.target])) throw Error('No permission');
          }
          populates[colname] = populates[colname] ?? { className: dataType.target, subpaths: [] };
          populates[colname].subpaths.push(_.isEmpty(subpath) ? '*' : subpath.join('.'));
        } else if (_.isEmpty(subpath)) {
          _includes.push(colname);
        } else {
          throw Error(`Invalid include: ${include}`);
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

  decodeMatches(className: string, matches: Record<string, TQueryBaseOptions>, includes: string[]): Record<string, DecodedBaseQuery> {

    const schema = this.schema[className] ?? {};
    const _matches: Record<string, DecodedBaseQuery> = {};
    const _rperm = this.master ? [] : [{ _rperm: { $intersect: this.acls } }];
    const _expiredAt = { $or: [{ _expired_at: { $eq: null } }, { _expired_at: { $gt: new Date() } }] };

    for (const colname of _.uniq(_.compact(includes.map(x => _.first(x.split('.')))))) {
      if (!this.validateKeyPerm(colname, 'read', schema)) continue;

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      if (isPrimitive(dataType)) continue;

      _matches[colname] = {
        filter: QuerySelector.decode([..._rperm, _expiredAt]).simplify(),
        matches: this.decodeMatches(
          dataType.target, {},
          includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
        ),
      };
    }

    for (const [colname, match] of _.toPairs(matches)) {
      if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

      const dataType = schema.fields[colname] ?? defaultObjectKeyTypes[colname];
      if (!isRelation(dataType)) throw Error(`Invalid match: ${colname}`);
      if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
      if (!_.isNil(dataType.foreignField)) {
        const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
        if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(`Invalid match: ${colname}`);
        if (isPrimitive(foreignField)) throw Error(`Invalid match: ${colname}`);
        if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(`Invalid match: ${colname}`);
        if (!this.validateKeyPerm(dataType.foreignField, 'read', this.schema[dataType.target])) throw Error('No permission');
      }
      _matches[colname] = {
        ...match,
        filter: QuerySelector.decode([..._rperm, _expiredAt, ..._.castArray<TQuerySelector>(match.filter)]).simplify(),
        matches: this.decodeMatches(
          dataType.target, match.matches ?? {},
          includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
        ),
      };
      if (
        !_matches[colname].filter.validate(key => this.validateKey(dataType.target, key, 'read', QueryValidator.patterns.path))
      ) throw Error('No permission');
    }

    return _matches;
  }

  validateSort(
    matches: Record<string, DecodedBaseQuery>,
    includes: string[],
    parent?: string,
  ) {
    for (const [colname, match] of _.toPairs(matches)) {
      const path = parent ? `${parent}.${colname}` : colname;
      if (!_.every(_.keys(match.sort), k => includes.includes(`${path}.${k}`))) throw Error('Invalid sort keys');
      this.validateSort(match.matches, includes, path)
    }
  }

  decodeQuery<Q extends FindOptions | FindOptions | FindOneOptions>(query: Q, action: keyof TSchema.ACLs): DecodedQuery<Q> {

    const filter = QuerySelector.decode([
      ..._.castArray<TQuerySelector>(query.filter),
      ...this.master ? [] : [{ [action === 'read' ? '_rperm' : '_wperm']: { $intersect: this.acls } }],
      { $or: [{ _expired_at: { $eq: null } }, { _expired_at: { $gt: new Date() } }] },
    ]).simplify();
    if (
      !filter.validate(key => this.validateKey(query.className, key, 'read', QueryValidator.patterns.path))
    ) throw Error('No permission');

    const includes = this.decodeIncludes(query.className, query.includes ?? ['*']);
    const matches = this.decodeMatches(query.className, query.matches ?? {}, includes);

    if (!_.every(_.keys(query.sort), k => includes.includes(k))) throw Error('Invalid sort keys');
    this.validateSort(matches, includes);

    return {
      ...query,
      filter,
      matches,
      includes,
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
