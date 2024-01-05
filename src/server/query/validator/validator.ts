//
//  validator.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { QueryCoditionalSelector, QueryFieldSelector, QuerySelector } from './parser';
import { TSchema, _typeof, isPointer, isPrimitive, isRelation, isShapedObject, shapedObjectPaths } from '../../../internals/schema';
import { ProtoService } from '../../proto';
import { TQueryBaseOptions } from '../../../internals/query/base';

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export const _resolveColumn = (schema: Record<string, TSchema>, className: string, path: string) => {
  const _schema = schema[className] ?? {};
  let [colname, ...subpath] = path.split('.');
  let dataType = _schema.fields[colname];
  while (dataType && !_.isEmpty(subpath) && isShapedObject(dataType)) {
    const [key, ...remain] = subpath;
    if (!dataType.shape[key]) break;
    dataType = dataType.shape[key];
    colname = `${colname}.${key}`;
    subpath = remain;
  }
  return {
    paths: [colname, ...subpath],
    dataType,
  };
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

  get _rperm() { return this.master ? [] : [{ _rperm: { $intersect: this.acls } }]; }
  get _wperm() { return this.master ? [] : [{ _wperm: { $intersect: this.acls } }]; }
  _expiredAt = { $or: [{ _expired_at: { $eq: null } }, { _expired_at: { $gt: new Date() } }] };

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
    key = _.first(key?.split('.')) ?? key;
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

  validateForeignField(dataType: TSchema.RelationType, type: keyof TSchema.FLPs, errorMeg: string) {
    if (_.isNil(dataType.foreignField)) return;
    const foreignField = this.schema[dataType.target]?.fields[dataType.foreignField];
    if (_.isNil(foreignField) || _.isString(foreignField)) throw Error(errorMeg);
    if (isPrimitive(foreignField)) throw Error(errorMeg);
    if (foreignField.type === 'relation' && !_.isNil(foreignField.foreignField)) throw Error(errorMeg);
    if (!this.validateKeyPerm(dataType.foreignField, type, this.schema[dataType.target])) throw Error('No permission');
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

    const [colname, ..._subpath] = _.toPath(_key);
    if (!this.validateKeyPerm(colname, type, schema)) return false;
    if (_.isEmpty(_subpath) && TObject.defaultKeys.includes(colname)) return true;
    if (_.isEmpty(_subpath)) return true;

    const { paths: [_colname, ...subpath], dataType } = _resolveColumn(this.schema, className, _key);
    const isElem = _.first(subpath)?.match(QueryValidator.patterns.digits);
    if (isElem) {
      if (dataType === 'array') return true;
      if (!_.isString(dataType) && dataType.type !== 'relation') return false;
    }

    if (isPrimitive(dataType)) return true;

    const relations: (TSchema.PointerType | TSchema.RelationType)[] = [];

    if (isShapedObject(dataType)) {
      for (const { type } of shapedObjectPaths(dataType)) {
        if (!isPrimitive(type)) relations.push(type);
      }
    } else {
      relations.push(dataType);
    }

    for (const relation of relations) {
      if (_.isNil(this.schema[relation.target])) return false;
      if (type === 'read' && !this.validateCLPs(relation.target, 'get')) return false;
      if (relation.type === 'relation') this.validateForeignField(relation, type, `Invalid key: ${_key}`);
    }

    if (isShapedObject(dataType)) {
      if (!_.isEmpty(subpath)) throw Error(`Invalid key: ${_key}`);
      return true;
    }

    const _sub = isElem ? subpath.slice(1) : subpath;
    return _.isEmpty(_sub) || this.validateKey(dataType.target, _sub, type, validator);
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

    const _includes: string[] = [];
    const populates: Record<string, { className: string; subpaths: string[]; }> = {};

    for (const include of includes) {
      if (include === '*') {
        const primitive = _.pickBy(schema.fields, (v, k) => isPrimitive(v) && this.validateKeyPerm(k, 'read', schema));
        const shapedObject = _.pickBy(schema.fields, (v, k) => isShapedObject(v) && this.validateKeyPerm(k, 'read', schema));
        _includes.push(
          ..._.keys(primitive),
          ..._.flatMap(shapedObject, (v, k) => _.flatMap(shapedObjectPaths(v as any), x => isPrimitive(x.type) ? [`${k}.${x.path}`] : [])),
        );
      } else {
        const { paths: [colname, ...subpath], dataType } = _resolveColumn(this.schema, className, include);
        if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

        if (isPointer(dataType) || isRelation(dataType)) {
          if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
          if (dataType.type === 'relation') this.validateForeignField(dataType, 'read', `Invalid include: ${include}`);

          const isDigit = _.first(subpath)?.match(QueryValidator.patterns.digits);
          const _subpath = isRelation(dataType) && isDigit ? _.slice(subpath, 1) : subpath;

          populates[colname] = populates[colname] ?? { className: dataType.target, subpaths: [] };
          populates[colname].subpaths.push(_.isEmpty(_subpath) ? '*' : _subpath.join('.'));

        } else if (_.isEmpty(subpath) && isShapedObject(dataType)) {

          for (const { path, type } of shapedObjectPaths(dataType)) {
            if (isPrimitive(type)) {
              _includes.push(`${colname}.${path}`);
            } else {

              if (!this.validateCLPs(type.target, 'get')) throw Error('No permission');
              if (type.type === 'relation') this.validateForeignField(type, 'read', `Invalid include: ${include}`);

              populates[`${colname}.${path}`] = populates[`${colname}.${path}`] ?? { className: type.target, subpaths: [] };
              populates[`${colname}.${path}`].subpaths.push('*');
            }
          }

        } else if (_.isEmpty(subpath) || _.includes(['object', 'array'], _typeof(dataType))) {
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

    for (const { paths: [colname], dataType } of _.map(includes, x => _resolveColumn(this.schema, className, x))) {
      if (!this.validateKeyPerm(colname, 'read', schema)) continue;
      if (isPrimitive(dataType) || isShapedObject(dataType)) continue;
      _matches[colname] = {
        filter: QuerySelector.decode([...this._rperm, this._expiredAt]).simplify(),
        matches: this.decodeMatches(
          dataType.target, {},
          includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
        ),
      };
    }

    for (const [colname, match] of _.toPairs(matches)) {
      if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

      const { dataType } = _resolveColumn(this.schema, className, colname);
      if (!isRelation(dataType)) throw Error(`Invalid match: ${colname}`);
      if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
      this.validateForeignField(dataType, 'read', `Invalid match: ${colname}`);
      _matches[colname] = {
        ...match,
        filter: QuerySelector.decode([
          ...this._rperm,
          this._expiredAt,
          ..._.castArray<TQuerySelector>(match.filter),
        ]).simplify(),
        matches: this.decodeMatches(
          dataType.target, match.matches ?? {},
          includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
        ),
      };
    }

    return _matches;
  }

  decodeQuery<Q extends FindOptions | FindOptions | FindOneOptions>(query: Q, action: keyof TSchema.ACLs): DecodedQuery<Q> {

    const filter = QuerySelector.decode([
      ..._.castArray<TQuerySelector>(query.filter),
      ...action === 'read' ? this._rperm : this._wperm,
      this._expiredAt,
    ]).simplify();

    const matcheKeyPaths = (
      matches: Record<string, TQueryBaseOptions>
    ): string[] => _.flatMap(matches, (match, key) => [
      ..._.keys(match.sort),
      ...QuerySelector.decode(match.filter ?? []).keyPaths(),
      ...matcheKeyPaths(match.matches ?? {}),
    ].map(x => `${key}.${x}`));

    const keyPaths = _.uniq([
      ...query.includes ?? ['*'],
      ..._.keys(query.sort),
      ...filter.keyPaths(),
      ...matcheKeyPaths(query.matches ?? {}),
    ]);

    const includes = this.decodeIncludes(query.className, keyPaths);
    const matches = this.decodeMatches(query.className, query.matches ?? {}, includes);

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

    if (query instanceof QueryCoditionalSelector && query.type === '$and') {
      for (const expr of query.exprs) {
        if (
          expr instanceof QueryFieldSelector &&
          expr.field === '_id' &&
          expr.expr.type === '$eq'
        ) {
          if (!_.isString(expr.expr.value)) return false;
          objectIds.push(expr.expr.value);
        }
      }
    } else if (
      query instanceof QueryFieldSelector &&
      query.field === '_id' &&
      query.expr.type === '$eq'
    ) {
      if (!_.isString(query.expr.value)) return false;
      objectIds.push(query.expr.value);
    }

    return _.uniq(objectIds).length === 1;
  }

}
