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
import _ from "lodash";
import { Proto } from "../../index";
import { ExtraOptions, TValue, UpdateOp } from "../../../internals";
import { QueryValidator } from "./validator";
import { ExplainOptions, FindOneOptions, FindOptions } from '../../storage';

export const normalize = <T>(x: T): T => {
  if (_.isString(x)) return x.normalize('NFD') as T;
  if (_.isArray(x)) return _.map(x, x => normalize(x)) as T;
  if (_.isPlainObject(x)) return _.fromPairs(_.map(_.toPairs(x as object), ([k, v]) => [normalize(k), normalize(v)])) as T;
  return x;
};

export const queryValidator = <E>(proto: Proto<E>, className: string, options?: ExtraOptions) => {

  const acls = () => _.compact([..._.map(proto.roles, x => `role:${x}`), proto.user?.objectId]);
  const validator = () => new QueryValidator(proto.schema, acls());

  return {
    explain(
      query: ExplainOptions
    ) {
      if (!_.has(proto.schema, className)) throw new Error('No permission');

      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!options?.master && !_validator.validateCLPs(className, 'count')) throw new Error('No permission');

      return proto.storage.explain(_validator.decodeQuery(normalize(query)));
    },
    count(
      query: FindOptions
    ) {
      if (!_.has(proto.schema, className)) throw new Error('No permission');

      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!options?.master && !_validator.validateCLPs(className, 'count')) throw new Error('No permission');

      return proto.storage.count(_validator.decodeQuery(normalize(query)));
    },
    find(
      query: FindOptions
    ) {
      if (!_.has(proto.schema, className)) throw new Error('No permission');

      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      const decoded = _validator.decodeQuery(normalize(query));
      const isGet = _validator.isGetMethod(decoded.filter);

      if (!options?.master && !_validator.validateCLPs(className, isGet ? 'get' : 'find')) throw new Error('No permission');

      return proto.storage.find(decoded);
    },
    insert(
      className: string,
      attrs: Record<string, TValue>
    ) {
      QueryValidator.recursiveCheck(attrs);
      const _validator = validator();
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validator.validateCLPs(className, 'create')) throw new Error('No permission');

      return proto.storage.insert(
        className,
        normalize(_validator.validateFields(className, attrs, 'create', QueryValidator.patterns.name)),
      );
    },
    findOneAndUpdate(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>
    ) {
      QueryValidator.recursiveCheck(query, update);
      const _validator = validator();
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validator.validateCLPs(className, 'update')) throw new Error('No permission');

      return proto.storage.findOneAndUpdate(
        _validator.decodeQuery(normalize(query)),
        normalize(_validator.validateFields(className, update, 'update', QueryValidator.patterns.path)),
      );
    },
    findOneAndReplace(
      query: FindOneOptions,
      replacement: Record<string, TValue>
    ) {
      QueryValidator.recursiveCheck(query, replacement);
      const _validator = validator();
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validator.validateCLPs(className, 'update')) throw new Error('No permission');

      return proto.storage.findOneAndReplace(
        _validator.decodeQuery(normalize(query)),
        normalize(_validator.validateFields(className, replacement, 'update', QueryValidator.patterns.path)),
      );
    },
    findOneAndUpsert(
      query: FindOneOptions,
      update: Record<string, [UpdateOp, TValue]>,
      setOnInsert: Record<string, TValue>
    ) {
      QueryValidator.recursiveCheck(query, update, setOnInsert);
      const _validator = validator();
      if (!_.has(proto.schema, className)) throw new Error('No permission');
      if (!options?.master && !_validator.validateCLPs(className, 'create', 'update')) throw new Error('No permission');

      return proto.storage.findOneAndUpsert(
        _validator.decodeQuery(normalize(query)),
        normalize(_validator.validateFields(className, update, 'update', QueryValidator.patterns.path)),
        normalize(_validator.validateFields(className, setOnInsert, 'create', QueryValidator.patterns.name)),
      );
    },
    findOneAndDelete(
      query: FindOneOptions
    ) {
      if (!_.has(proto.schema, className)) throw new Error('No permission');

      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!options?.master && !_validator.validateCLPs(className, 'delete')) throw new Error('No permission');

      return proto.storage.findOneAndDelete(_validator.decodeQuery(normalize(query)));
    },
    findAndDelete(
      query: FindOptions
    ) {
      if (!_.has(proto.schema, className)) throw new Error('No permission');

      QueryValidator.recursiveCheck(query);
      const _validator = validator();
      if (!options?.master && !_validator.validateCLPs(className, 'delete')) throw new Error('No permission');

      return proto.storage.findAndDelete(_validator.decodeQuery(normalize(query)));
    },
  };
};

