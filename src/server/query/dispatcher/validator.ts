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
import { DecodedBaseQuery, DecodedQuery, FindOptions, FindOneOptions, DecodedSortOption, RelationOptions } from '../../storage';
import { QueryCoditionalSelector, QueryFieldSelector, QuerySelector } from './parser';
import { TSchema, _typeof, isPointer, isPrimitive, isRelation, isShape, isVector, shapePaths } from '../../../internals/schema';
import { ProtoService } from '../../proto';
import { TQueryBaseOptions, TSortOption } from '../../../internals/query/base';
import { isPrimitiveValue } from '../../../internals/object';
import { TObject } from '../../../internals/object';
import { PVK } from '../../../internals/private';
import { TQuerySelector } from '../../../internals/query/types/selectors';
import { QueryExpression } from './parser/expressions';

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
  while (dataType && !_.isEmpty(subpath) && isShape(dataType)) {
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
    path: /^[a-z_][\w-]*(\[\d+\]|\.\d*|\.[a-z_][\w-]*)*$/gi,
    name: /^[a-z_][\w-]*$/gi,
    digits: /^\d+$/g,
  }

  _rperm(className: string) {
    if (this.master) return [];
    const check = _.intersection(this.schema[className]?.additionalObjectPermissions?.read, this.acls);
    if (!_.isEmpty(check)) return [];
    return [{ _rperm: { $intersect: this.acls } }];
  }
  _wperm(className: string) {
    if (this.master) return [];
    const check = _.intersection(this.schema[className]?.additionalObjectPermissions?.update, this.acls);
    if (!_.isEmpty(check)) return [];
    return [{ _wperm: { $intersect: this.acls } }];
  }
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
    return this.master || this.proto[PVK].validateCLPs(className, this.acls, keys);
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
    if (isVector(dataType)) return true;

    const relations: (TSchema.PointerType | TSchema.RelationType)[] = [];

    if (isShape(dataType)) {
      for (const { type } of shapePaths(dataType)) {
        if (!isPrimitive(type) && !isVector(type)) relations.push(type);
      }
    } else {
      relations.push(dataType);
    }

    for (const relation of relations) {
      if (_.isNil(this.schema[relation.target])) return false;
      if (type === 'read' && !this.validateCLPs(relation.target, 'get')) return false;
      if (relation.type === 'relation') this.validateForeignField(relation, type, `Invalid key: ${_key}`);
    }

    if (isShape(dataType)) {
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
        const shapedObject = _.pickBy(schema.fields, (v, k) => isShape(v) && this.validateKeyPerm(k, 'read', schema));
        _includes.push(
          ..._.keys(primitive),
          ..._.flatMap(shapedObject, (v, k) => _.flatMap(shapePaths(v as any), x => isPrimitive(x.type) ? [`${k}.${x.path}`] : [])),
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

        } else if (_.isEmpty(subpath) && isShape(dataType)) {

          for (const { path, type } of shapePaths(dataType)) {
            if (isPrimitive(type) || isVector(type)) {
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

  decodeSort(sort: Record<string, 1 | -1> | TSortOption[]): Record<string, 1 | -1> | DecodedSortOption[] {
    if (_.isArray(sort)) {
      return _.map(sort, s => ({
        order: s.order,
        expr: QueryExpression.decode(s.expr, false).simplify(),
      }))
    }
    return sort;
  }

  decodeMatches(className: string, matches: Record<string, TQueryBaseOptions>, includes: string[]): Record<string, DecodedBaseQuery> {

    const schema = this.schema[className] ?? {};
    const _matches: Record<string, DecodedBaseQuery> = {};

    for (const { paths: [colname], dataType } of _.map(includes, x => _resolveColumn(this.schema, className, x))) {
      if (!this.validateKeyPerm(colname, 'read', schema)) continue;
      if (isPrimitive(dataType) || isVector(dataType) || isShape(dataType)) continue;
      _matches[colname] = {
        filter: QuerySelector.decode([...this._rperm(dataType.target), this._expiredAt]).simplify(),
        matches: this.decodeMatches(
          dataType.target, {},
          includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
        ),
      };
    }

    for (const [colname, match] of _.toPairs(matches)) {
      if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

      const { paths: [_colname, ...subpath], dataType } = _resolveColumn(this.schema, className, colname);

      if (isPointer(dataType) && !_.isEmpty(subpath)) {
        _matches[_colname] = {
          filter: QuerySelector.decode([...this._rperm(dataType.target), this._expiredAt]).simplify(),
          matches: this.decodeMatches(
            dataType.target, { [subpath.join('.')]: match },
            includes.filter(x => x.startsWith(`${_colname}.`)).map(x => x.slice(_colname.length + 1)),
          ),
        };
      } else if (isRelation(dataType)) {
        if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
        this.validateForeignField(dataType, 'read', `Invalid match: ${colname}`);
        _matches[_colname] = {
          ...match,
          filter: QuerySelector.decode([
            ...this._rperm(dataType.target),
            this._expiredAt,
            ..._.castArray<TQuerySelector>(match.filter),
          ]).simplify(),
          matches: this.decodeMatches(
            dataType.target, match.matches ?? {},
            includes.filter(x => x.startsWith(`${_colname}.`)).map(x => x.slice(_colname.length + 1)),
          ),
          sort: match.sort && this.decodeSort(match.sort),
        };
      } else {
        throw Error(`Invalid match: ${colname}`);
      }
    }

    return _matches;
  }

  decodeQuery<Q extends (FindOptions & RelationOptions) | FindOneOptions>(query: Q, action: keyof TSchema.ACLs): DecodedQuery<Q> {

    let relation: TQuerySelector | undefined;

    if ('relatedBy' in query && query.relatedBy) {
      const { relatedBy } = query;
      if (relatedBy && !this.validateCLPs(relatedBy.className, 'get')) throw Error('No permission');
      if (relatedBy && !this.validateKey(relatedBy.className, relatedBy.key, 'read', QueryValidator.patterns.path)) throw Error('No permission');
      const { dataType } = _resolveColumn(this.schema, relatedBy.className, relatedBy.key);
      if (!isRelation(dataType) || dataType.target !== query.className) throw Error(`Invalid relation key: ${relatedBy.key}`);
      this.validateForeignField(dataType, 'read', `Invalid relation key: ${relatedBy.key}`);
      if (dataType.foreignField) {
        relation = {
          [dataType.foreignField]: {
            $eq: query.relatedBy.objectId,
          },
        };
      }
    }

    const filter = QuerySelector.decode([
      ...action === 'read' ? this._rperm(query.className) : this._wperm(query.className),
      ..._.castArray<TQuerySelector>(query.filter),
      ...relation ? [relation] : [],
      this._expiredAt,
    ]).simplify();

    const matcheKeyPaths = (
      matches: Record<string, TQueryBaseOptions>
    ): string[] => _.flatMap(matches, (match, key) => [
      ..._.keys(match.sort),
      ...QuerySelector.decode(match.filter ?? []).keyPaths(),
      ...matcheKeyPaths(match.matches ?? {}),
    ].map(x => `${key}.${x}`));

    const sort = query.sort && this.decodeSort(query.sort);

    const keyPaths = _.uniq([
      ...query.includes ?? ['*'],
      ..._.isArray(sort) ? _.flatMap(sort, s => s.expr.keyPaths()) : _.keys(sort),
      ...filter.keyPaths(),
      ...matcheKeyPaths(query.matches ?? {}),
    ]);

    const includes = this.decodeIncludes(query.className, keyPaths);
    const matches = this.decodeMatches(query.className, query.matches ?? {}, includes);

    return {
      ...relation ? _.omit(query, 'relatedBy') : query,
      filter,
      matches,
      includes,
      sort,
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
