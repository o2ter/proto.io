//
//  methods.ts
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
import { ProtoBase } from '../../proto/base';
import { ExtraOptions, PVK, TValue, UpdateOp } from '../../../internals';
import { QueryValidator } from './validator';
import { FindOptions, FindOneOptions } from '../../storage';
import { TQueryBaseOptions } from '../../../internals/query/base';

export const normalize = <T>(x: T): T => {
  if (_.isString(x)) return x.normalize('NFD') as T;
  if (_.isArray(x)) return _.map(x, x => normalize(x)) as T;
  if (_.isPlainObject(x)) return _.fromPairs(_.map(_.toPairs(x as object), ([k, v]) => [normalize(k), normalize(v)])) as T;
  return x;
};

export const queryValidator = <E>(proto: ProtoBase<E>, options?: ExtraOptions) => {

  const acls = () => _.uniq(_.compact([..._.map(proto.roles, x => `role:${x}`), proto.user?.objectId]));
  const validator = () => new QueryValidator(proto, acls(), options?.master ?? false);

  return {
    explain(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      return proto.storage.explain(decoded);
    },
    count(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!_validator.validateCLPs(query.className, 'count')) throw Error('No permission');
      return proto.storage.count(_validator.decodeQuery(normalize(query), 'read'));
    },
    find(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      return proto.storage.find(decoded);
    },
    insert(
      options: {
        className: string;
        includes?: string[];
        matches?: Record<string, TQueryBaseOptions>;
      },
      attrs: Record<string, TValue>,
    ) {
      QueryValidator.recursiveCheck(attrs);
      const _validator = validator();
      const _includes = _validator.decodeIncludes(options.className, options.includes ?? ['*']);
      const _matches = _validator.decodeMatches(options.className, options.matches ?? {}, _includes);
      if (!_validator.validateCLPs(options.className, 'create')) throw Error('No permission');
      return proto.storage.insert({
        className: options.className,
        includes: _includes,
        matches: _matches,
        objectIdSize: proto[PVK].options.objectIdSize
      }, normalize(_validator.validateFields(options.className, attrs, 'create', QueryValidator.patterns.name)));
    },
    updateOne(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>
    ) {
      QueryValidator.recursiveCheck(query, update);
      const _validator = validator();
      if (!_validator.validateCLPs(query.className, 'update')) throw Error('No permission');
      return proto.storage.updateOne(
        _validator.decodeQuery(normalize(query), 'update'),
        normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path)),
      );
    },
    upsertOne(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>,
      setOnInsert: Record<string, TValue>
    ) {
      QueryValidator.recursiveCheck(query, update, setOnInsert);
      const _validator = validator();
      if (!_validator.validateCLPs(query.className, 'create', 'update')) throw Error('No permission');
      return proto.storage.upsertOne(
        _validator.decodeQuery(normalize(query), 'update'),
        normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path)),
        normalize(_validator.validateFields(query.className, setOnInsert, 'create', QueryValidator.patterns.name)),
      );
    },
    deleteOne(
      query: FindOneOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!_validator.validateCLPs(query.className, 'delete')) throw Error('No permission');
      return proto.storage.deleteOne(_validator.decodeQuery(normalize(query), 'update'));
    },
    deleteMany(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!_validator.validateCLPs(query.className, 'delete')) throw Error('No permission');
      return proto.storage.deleteMany(_validator.decodeQuery(normalize(query), 'update'));
    },
  };
};

