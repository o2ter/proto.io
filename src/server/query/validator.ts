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
import { Proto } from '../index';
import {
  TValue,
  TObject,
  UpdateOp,
  ExtraOptions,
  isPrimitiveValue,
} from '../../internals';
import { DecodedQuery, ExplainOptions, FindOneOptions, FindOptions } from '../storage';
import { QuerySelector } from './parser';
import { TSchema } from '../schema';

export const PathValidator = /^[a-z_]\w*(((\.\*)|(\[\d+\]))?\.[a-z\d_]\w*)*$/gi;
export const NameValidator = /^[a-z_]\w*$/gi;

const validateCLPs = (
  clps: TSchema.CLPs,
  keys: (keyof TSchema.CLPs)[],
  acls: string[],
) => {
  for (const key of keys) {
    if (_.includes(clps[key] ?? ['*'], '*')) continue;
    if (_.every(clps[key], x => !_.includes(acls, x))) return false;
  }
  return true;
}

type ValidateKeyInfo = {
  className: string;
  schema: Record<string, TSchema>;
  acls: string[];
};

const validateKey = (
  key: string | string[],
  type: keyof TSchema.ACLs,
  info: ValidateKeyInfo,
): boolean => {

  const schema = info.schema[info.className] ?? {};
  const _key = _.isArray(key) ? key.join('.') : key;
  if (!_key.match(PathValidator)) throw Error(`Invalid key: ${_key}`);

  const [keyRoot, ...path] = _.toPath(_key);
  if (_.isEmpty(keyRoot) || !_.has(schema.fields, keyRoot)) throw Error(`Invalid path: ${_key}`);

  const perms = schema.fieldLevelPermissions?.[keyRoot]?.[type] ?? ['*'];
  if (!_.includes(perms, '*') && _.every(perms, x => !_.includes(info.acls, x))) return false;
  if (_.isEmpty(path)) return true;

  const dataType = schema.fields[keyRoot];
  if (_.isString(dataType)) return true;
  if (dataType.type !== 'pointer' && dataType.type !== 'relation') return true;
  if (_.isNil(info.schema[dataType.target])) return false;

  return validateKey(path, type, info);
};

const validateFields = <T extends Record<string, any>>(
  values: T,
  type: keyof TSchema.ACLs,
  info: ValidateKeyInfo,
) => {
  const _values = { ...values };
  for (const key of _.keys(_values)) {
    if (!validateKey(key, type, info)) throw new Error('No permission');
  }
  return _values;
}

const normalize = <T>(x: T): T => {
  if (_.isString(x)) return x.normalize('NFD') as T;
  if (_.isArray(x)) return _.map(x, x => normalize(x)) as T;
  if (_.isPlainObject(x)) return _.mapValues(x as any, x => normalize(x));
  return x;
};

const decodeQuery = <Q extends ExplainOptions | FindOptions | FindOneOptions>(
  query: Q,
  info: ValidateKeyInfo,
): DecodedQuery<Q> => {
  const filter = QuerySelector.decode(query.filter ?? []).simplify();
  if (!filter.validate(key => validateKey(key, 'read', info))) throw new Error('No permission');
  return { ...query, filter }
};

const recursiveCheck = (x: any, stack: any[] = []) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
}

export const queryValidator = <E>(proto: Proto<E>, className: string, options?: ExtraOptions) => {

  const schema = () => proto.schema[className] ?? {};
  const classLevelPermissions = () => schema().classLevelPermissions ?? {};
  const validateKeyInfo = () => ({ className, schema: proto.schema, acls: acls() });

  const acls = () => [
    ..._.map(proto.roles, x => `role:${x}`),
    proto.user?.objectId,
  ].filter(Boolean) as string[];

  const _validateCLPs = (...keys: (keyof TSchema.CLPs)[]) => validateCLPs(classLevelPermissions(), keys, acls());
  const _validateFields = <T extends Record<string, any>>(values: T, type: keyof TSchema.ACLs) => validateFields(values, type, validateKeyInfo());
  const _decodeQuery = <Q extends ExplainOptions | FindOptions | FindOneOptions>(query: Q) => decodeQuery(query, validateKeyInfo());

  return {
    explain(
      query: ExplainOptions,
    ) {
      recursiveCheck(query);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('count')) throw new Error('No permission');
      return proto.storage.explain(_decodeQuery(normalize(query)));
    },
    count(
      query: FindOptions,
    ) {
      recursiveCheck(query);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('count')) throw new Error('No permission');
      return proto.storage.count(_decodeQuery(normalize(query)));
    },
    find(
      query: FindOptions,
    ) {
      recursiveCheck(query);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('find')) throw new Error('No permission');
      return proto.storage.find(_decodeQuery(normalize(query)));
    },
    insert(
      className: string,
      attrs: Record<string, TValue>,
    ) {
      recursiveCheck(attrs);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('create')) throw new Error('No permission');
      if (!_.every(_.keys(attrs), k => k.match(NameValidator))) throw new Error(`Invalid key: ${_.find(_.keys(attrs), k => !k.match(NameValidator))}`);
      return proto.storage.insert(className, normalize(_validateFields(attrs, 'create')));
    },
    findOneAndUpdate(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>,
    ) {
      recursiveCheck(query);
      recursiveCheck(update);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('update')) throw new Error('No permission');
      if (!_.every(_.keys(update), k => k.match(PathValidator))) throw new Error(`Invalid path: ${_.find(_.keys(update), k => !k.match(PathValidator))}`);
      return proto.storage.findOneAndUpdate(_decodeQuery(normalize(query)), normalize(_validateFields(update, 'update')));
    },
    findOneAndReplace(
      query: FindOneOptions,
      replacement: Record<string, TValue>,
    ) {
      recursiveCheck(query);
      recursiveCheck(replacement);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('update')) throw new Error('No permission');
      if (!_.every(_.keys(replacement), k => k.match(NameValidator))) throw new Error(`Invalid key: ${_.find(_.keys(replacement), k => !k.match(NameValidator))}`);
      return proto.storage.findOneAndReplace(_decodeQuery(normalize(query)), normalize(_validateFields(replacement, 'update')));
    },
    findOneAndUpsert(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>,
      setOnInsert: Record<string, TValue>,
    ) {
      recursiveCheck(query);
      recursiveCheck(update);
      recursiveCheck(setOnInsert);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('create', 'update')) throw new Error('No permission');
      if (!_.every(_.keys(update), k => k.match(PathValidator))) throw new Error(`Invalid path: ${_.find(_.keys(update), k => !k.match(PathValidator))}`);
      if (!_.every(_.keys(setOnInsert), k => k.match(NameValidator))) throw new Error(`Invalid key: ${_.find(_.keys(setOnInsert), k => !k.match(NameValidator))}`);
      return proto.storage.findOneAndUpsert(_decodeQuery(normalize(query)), normalize(_validateFields(update, 'update')), normalize(_validateFields(setOnInsert, 'create')));
    },
    findOneAndDelete(
      query: FindOneOptions,
    ) {
      recursiveCheck(query);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');
      return proto.storage.findOneAndDelete(_decodeQuery(normalize(query)));
    },
    findAndDelete(
      query: FindOptions,
    ) {
      recursiveCheck(query);
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validateCLPs('delete')) throw new Error('No permission');
      return proto.storage.findAndDelete(_decodeQuery(normalize(query)));
    },
  };
};