//
//  validator.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { DecodedBaseQuery, DecodedQuery, FindOptions, DecodedSortOption, RelationOptions } from '../../storage';
import { QueryCoditionalSelector, QueryFieldSelector, QuerySelector } from './parser';
import { TSchema, _typeof, isPointer, isPrimitive, isRelation, isShape, isVector, shapePaths } from '../../../internals/schema';
import { ProtoService } from '../../proto';
import { TQueryBaseOptions, TSortOption } from '../../../internals/query/base';
import { isPrimitiveValue } from '../../../internals/object';
import { TObject } from '../../../internals/object';
import { PVK } from '../../../internals/private';
import { TQuerySelector } from '../../../internals/query/types/selectors';
import { QueryExpression } from './parser/expressions';
import { TQueryAccumulator } from '../../../internals/query/types/accumulators';
import { QueryAccumulator } from './parser/accumulators';

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export const resolveDataType = (
  schema: Record<string, TSchema>,
  classname: string,
  path: string,
) => {
  let fields = schema[classname].fields;
  let last;
  for (const key of _.toPath(path)) {
    const dataType = fields[key];
    if (_.isNil(dataType)) throw Error(`Invalid path: ${path}`);
    if (isPrimitive(dataType) || isVector(dataType)) return dataType;
    if (isShape(dataType)) {
      fields = dataType.shape;
      continue;
    }
    if (_.isNil(schema[dataType.target])) throw Error(`Invalid path: ${path}`);
    fields = schema[dataType.target].fields;
    last = dataType;
  }
  return last;
}

export const resolveColumn = (
  schema: Record<string, TSchema>,
  className: string,
  path: string,
) => {
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

type QueryValidatorOption = {
  master: boolean;
  disableSecurity: boolean;
};

export class QueryValidator<E> {

  proto: ProtoService<E>
  acls: string[];
  options: QueryValidatorOption;

  static patterns = {
    path: /^[a-z_][\w-]*(\[\d+\]|\.\d*|\.[a-z_][\w-]*)*$/gi,
    className: /^[a-z_][\w]*$/gi,
    fieldName: /^[a-z_][\w-]*$/gi,
    digits: /^\d+$/g,
  }

  _rperm(className: string) {
    if (this.options.master) return [];
    const check = _.intersection(this.schema[className]?.additionalObjectPermissions?.read, this.acls);
    if (!_.isEmpty(check)) return [];
    return [{ _rperm: { $intersect: this.acls } }];
  }
  _wperm(className: string) {
    if (this.options.master) return [];
    const check = _.intersection(this.schema[className]?.additionalObjectPermissions?.update, this.acls);
    if (!_.isEmpty(check)) return [];
    return [{ _wperm: { $intersect: this.acls } }];
  }
  _expiredAt = { $or: [{ _expired_at: { $eq: null } }, { _expired_at: { $gt: new Date() } }] };

  constructor(
    proto: ProtoService<E>,
    acls: string[],
    options: QueryValidatorOption,
  ) {
    this.proto = proto;
    this.acls = _.uniq(['*', ...acls]);
    this.options = options;
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
    if (!this.options.disableSecurity && _.includes(schema.secureFields, key)) return false;
    return this.options.master || !_.every(schema.fieldLevelPermissions?.[key]?.[type] ?? ['*'], x => !_.includes(this.acls, x));
  }

  validateCLPs(
    className: string,
    ...keys: (keyof TSchema.CLPs)[]
  ) {
    if (!_.has(this.schema, className)) throw Error('No permission');
    return this.options.master || this.proto[PVK].validateCLPs(className, this.acls, keys);
  }

  validateForeignField(dataType: TSchema.RelationType, type: keyof TSchema.FLPs, errorMeg: string) {
    if (_.isNil(dataType.foreignField)) return;
    const foreignField = resolveDataType(this.schema, dataType.target, dataType.foreignField);
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

    const { paths: [_colname, ...subpath], dataType } = resolveColumn(this.schema, className, _key);
    const isElem = _.first(subpath)?.match(QueryValidator.patterns.digits);
    if (isElem) {
      if (dataType === 'array' || dataType === 'string[]') return true;
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

  decodeGroupMatches(className: string, groupMatches: Record<string, Record<string, TQueryAccumulator>>): Record<string, Record<string, QueryAccumulator>> {
    const result = _.mapValues(groupMatches, m => _.mapValues(m, x => QueryAccumulator.decode(x).simplify()));
    for (const [colname, group] of _.entries(result)) {
      const dataType = resolveDataType(this.schema, className, colname);
      if (!dataType || !isRelation(dataType)) throw Error(`Invalid relation key: ${colname}`);
      for (const key of _.keys(group)) {
        if (!key.match(QueryValidator.patterns.fieldName)) throw Error(`Invalid field name: ${key}`);
      }
    }
    return result;
  }

  decodeIncludes(className: string, includes: string[], groupMatches: Record<string, Record<string, QueryAccumulator>>): string[] {

    const schema = this.schema[className] ?? {};

    const _includes: string[] = [];
    const populates: Record<string, {
      className: string;
      subpaths: string[];
      groupMatches: Record<string, Record<string, QueryAccumulator>>;
    }> = {};

    for (const include of includes) {
      if (include === '*') {
        const primitive = _.pickBy(schema.fields, (v, k) => isPrimitive(v) && this.validateKeyPerm(k, 'read', schema));
        const shapedObject = _.pickBy(schema.fields, (v, k) => isShape(v) && this.validateKeyPerm(k, 'read', schema));
        _includes.push(
          ..._.keys(primitive),
          ..._.flatMap(shapedObject, (v, k) => _.flatMap(shapePaths(v as any), x => isPrimitive(x.type) ? [`${k}.${x.path}`] : [])),
        );
      } else {
        const { paths: [colname, ...subpath], dataType } = resolveColumn(this.schema, className, include);
        if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

        if (isPointer(dataType) || isRelation(dataType)) {
          if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
          if (dataType.type === 'relation') this.validateForeignField(dataType, 'read', `Invalid include: ${include}`);

          const isDigit = _.first(subpath)?.match(QueryValidator.patterns.digits);
          const _subpath = isRelation(dataType) && isDigit ? _.slice(subpath, 1) : subpath;

          populates[colname] = populates[colname] ?? { className: dataType.target, subpaths: [], groupMatches: {} };
          const s = _.first(_subpath);
          if (!s || !groupMatches[colname]?.[s]) {
            populates[colname].subpaths.push(_.isEmpty(_subpath) ? '*' : _subpath.join('.'));
            populates[colname].groupMatches = _.mapKeys(_.pickBy(groupMatches, (x, k) => _.startsWith(k, `${colname}.`)), (x, k) => k.slice(colname.length + 1));
          }

        } else if (_.isEmpty(subpath) && isShape(dataType)) {

          for (const { path, type } of shapePaths(dataType)) {
            if (isPrimitive(type) || isVector(type)) {
              _includes.push(`${colname}.${path}`);
            } else {

              if (!this.validateCLPs(type.target, 'get')) throw Error('No permission');
              if (type.type === 'relation') this.validateForeignField(type, 'read', `Invalid include: ${include}`);

              populates[`${colname}.${path}`] = populates[`${colname}.${path}`] ?? { className: type.target, subpaths: [], groupMatches: {} };
              populates[`${colname}.${path}`].subpaths.push('*');
              populates[`${colname}.${path}`].groupMatches = _.mapKeys(_.pickBy(groupMatches, (x, k) => _.startsWith(k, `${colname}.${path}.`)), (x, k) => k.slice(`${colname}.${path}`.length + 1));
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
      const subpaths = this.decodeIncludes(populate.className, populate.subpaths, populate.groupMatches);
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

    const _includes = _.groupBy(_.map(includes, x => resolveColumn(this.schema, className, x)), ({ paths: [colname] }) => colname);

    for (const [colname, [{ dataType }]] of _.entries(_includes)) {
      if (!this.validateKeyPerm(colname, 'read', schema)) continue;
      if (isPrimitive(dataType) || isVector(dataType) || isShape(dataType)) continue;
      if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
      if (isRelation(dataType) && dataType.foreignField && dataType.match) {
        this.validateForeignField(dataType, 'read', `Invalid match: ${colname}`);
        const groupMatches = this.decodeGroupMatches(dataType.target, dataType.match.groupMatches ?? {});
        _matches[colname] = {
          ...dataType.match,
          groupMatches,
          filter: QuerySelector.decode(_.castArray<TQuerySelector>(dataType.match.filter)).simplify(),
          matches: this.decodeMatches(
            dataType.target, dataType.match.matches ?? {},
            includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
          ),
          sort: dataType.match.sort && this.decodeSort(dataType.match.sort),
        };
      } else {
        _matches[colname] = {
          matches: this.decodeMatches(
            dataType.target, {},
            includes.filter(x => x.startsWith(`${colname}.`)).map(x => x.slice(colname.length + 1)),
          ),
        };
      }
    }

    for (const [colname, match] of _.toPairs(matches)) {
      if (!this.validateKeyPerm(colname, 'read', schema)) throw Error('No permission');

      const { paths: [_colname, ...subpath], dataType } = resolveColumn(this.schema, className, colname);

      if (isPointer(dataType) && !_.isEmpty(subpath)) {
        if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
        _matches[_colname] = {
          matches: this.decodeMatches(
            dataType.target, { [subpath.join('.')]: match },
            includes.filter(x => x.startsWith(`${_colname}.`)).map(x => x.slice(_colname.length + 1)),
          ),
        };
      } else if (isRelation(dataType)) {
        if (!this.validateCLPs(dataType.target, 'get')) throw Error('No permission');
        this.validateForeignField(dataType, 'read', `Invalid match: ${colname}`);
        const groupMatches = this.decodeGroupMatches(dataType.target, match.groupMatches ?? {});
        _matches[_colname] = {
          ...match,
          groupMatches,
          filter: QuerySelector.decode(_.castArray<TQuerySelector>(match.filter)).simplify(),
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

  validateRelatedBy(className: string | null, relation: { className: string; key: string; }) {

    if (!this.validateCLPs(relation.className, 'get')) throw Error('No permission');
    if (!this.validateKey(relation.className, relation.key, 'read', QueryValidator.patterns.path)) throw Error('No permission');

    const { dataType } = resolveColumn(this.schema, relation.className, relation.key);
    if (!isPointer(dataType) && !isRelation(dataType)) throw Error(`Invalid relation key: ${relation.key}`);
    if (className && dataType.target !== className) throw Error(`Invalid relation key: ${relation.key}`);

    if (isRelation(dataType) && dataType.foreignField) {
      this.validateForeignField(dataType, 'read', `Invalid relation key: ${relation.key}`);
      this.validateRelatedBy(null, { className: dataType.target, key: dataType.foreignField });
    }
  }

  _decodeQueryBaseInfo(query: TQueryBaseOptions & { className: string; }, action: keyof TSchema.ACLs) {

    const filter = QuerySelector.decode([
      ...action === 'read' ? this._rperm(query.className) : this._wperm(query.className),
      ..._.castArray<TQuerySelector>(query.filter),
      this._expiredAt,
    ]).simplify();

    const groupMatches = this.decodeGroupMatches(query.className, query.groupMatches ?? {});

    const matchKeyPaths = (
      matches: Record<string, TQueryBaseOptions>
    ): string[] => _.flatMap(matches, (match, key) => [
      ..._.keys(match.sort),
      ...QuerySelector.decode(match.filter ?? []).keyPaths(),
      ...matchKeyPaths(match.matches ?? {}),
      ..._.keys(match.groupMatches),
      ..._.flatMap(_.values(match.groupMatches), x => QueryAccumulator.decode(x).keyPaths()),
    ].map(x => `${key}.${x}`));

    const sort = query.sort && this.decodeSort(query.sort);

    const keyPaths = _.uniq([
      ..._.isArray(sort) ? _.flatMap(sort, s => s.expr.keyPaths()) : _.keys(sort),
      ...filter.keyPaths(),
      ...matchKeyPaths(query.matches ?? {}),
      ..._.keys(groupMatches),
      ..._.flatMap(_.values(groupMatches), m => _.flatMap(_.values(m), x => x.keyPaths())),
    ]);

    return { groupMatches, filter, sort, keyPaths };
  }

  decodeQuery<Q extends FindOptions & RelationOptions>(query: Q, action: keyof TSchema.ACLs): DecodedQuery<Q> {

    if ('relatedBy' in query && query.relatedBy) this.validateRelatedBy(query.className, query.relatedBy);

    const { groupMatches, filter, sort, keyPaths: _keyPaths } = this._decodeQueryBaseInfo(query, action)

    const keyPaths = _.uniq([
      ...query.includes ?? ['*'],
      ..._keyPaths,
    ]);

    const includes = this.decodeIncludes(query.className, keyPaths, groupMatches);
    const matches = this.decodeMatches(query.className, query.matches ?? {}, includes);

    return {
      ...query,
      groupMatches,
      filter,
      matches,
      includes,
      sort,
      objectIdSize: this.objectIdSize,
      extraFilter: (className) => QuerySelector.decode([...this._rperm(className), this._expiredAt]).simplify(),
    };
  }

  isGetMethod(query: QuerySelector) {

    const ids = [];

    if (query instanceof QueryCoditionalSelector && query.type === '$and') {
      for (const expr of query.exprs) {
        if (
          expr instanceof QueryFieldSelector &&
          expr.field === '_id' &&
          expr.expr.type === '$eq'
        ) {
          if (!_.isString(expr.expr.value)) return false;
          ids.push(expr.expr.value);
        }
      }
    } else if (
      query instanceof QueryFieldSelector &&
      query.field === '_id' &&
      query.expr.type === '$eq'
    ) {
      if (!_.isString(query.expr.value)) return false;
      ids.push(query.expr.value);
    }

    return _.uniq(ids).length === 1;
  }

}
