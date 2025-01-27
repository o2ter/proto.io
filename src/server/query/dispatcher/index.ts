//
//  methods.ts
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
import { ProtoService } from '../../proto/index';
import { QueryValidator } from './validator';
import { FindOptions, FindOneOptions, RelationOptions } from '../../storage';
import { TQueryBaseOptions } from '../../../internals/query/base';
import { ExtraOptions } from '../../../internals/options';
import { TQueryRandomOptions } from '../../../internals/query';
import { TValue, TValueWithUndefined } from '../../../internals/types';
import { PVK } from '../../../internals/private';
import { TUpdateOp } from '../../../internals/object/types';
import { normalize } from '../../utils';

export const fetchUserPerms = async <E>(proto: ProtoService<E>) => _.uniq(_.compact([..._.map(await proto.currentRoles(), x => `role:${x}`), (await proto.currentUser())?.objectId]));

export const dispatcher = <E>(
  proto: ProtoService<E>,
  options: ExtraOptions<boolean> & {
    disableSecurity: boolean;
  },
) => {

  const acls = async () => options.master ? [] : await fetchUserPerms(proto);
  const validator = async () => new QueryValidator(proto, await acls(), {
    master: options.master ?? false,
    disableSecurity: options.disableSecurity,
  });

  return {
    async explain(
      query: FindOptions & RelationOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      return proto.storage.explain(decoded);
    },
    async count(
      query: FindOptions & RelationOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'count')) throw Error('No permission');
      return proto.storage.count(_validator.decodeQuery(normalize(query), 'read'));
    },
    async find(
      query: FindOptions & RelationOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      return proto.storage.find(decoded);
    },
    async nonrefs(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      return proto.storage.nonrefs(decoded);
    },
    async random(
      query: FindOptions & RelationOptions,
      opts?: TQueryRandomOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      const decoded = _validator.decodeQuery(normalize(query), 'read');
      const isGet = _validator.isGetMethod(decoded.filter);
      if (!_validator.validateCLPs(query.className, isGet ? 'get' : 'find')) throw Error('No permission');
      if (opts?.weight && !_validator.validateKey(query.className, opts.weight, 'read', QueryValidator.patterns.path)) throw Error('No permission');
      return proto.storage.random(decoded, opts);
    },
    async insert(
      options: {
        className: string;
        includes?: string[];
        matches?: Record<string, TQueryBaseOptions>;
        countMatches?: string[];
      },
      attrs: Record<string, TValueWithUndefined>,
    ) {
      QueryValidator.recursiveCheck(attrs);
      const _validator = await validator();
      _validator.validateCountMatches(options.className, options.countMatches ?? []);
      const _includes = _validator.decodeIncludes(options.className, options.includes ?? ['*']);
      const _matches = _validator.decodeMatches(options.className, options.matches ?? {}, _includes);
      if (!_validator.validateCLPs(options.className, 'create')) throw Error('No permission');
      const _attrs = normalize(_validator.validateFields(options.className, attrs, 'create', QueryValidator.patterns.path));
      while (true) {
        try {
          return await proto.storage.atomic(
            (storage) => storage.insert({
              className: options.className,
              includes: _includes,
              matches: _matches,
              countMatches: options.countMatches ?? [],
              objectIdSize: proto[PVK].options.objectIdSize
            }, _attrs),
            { lockTable: options.className, retry: true },
          );
        } catch (e) {
          if (proto.storage.isDuplicateIdError(e)) continue;
          throw e;
        }
      }
    },
    async insertMany(
      options: {
        className: string;
        includes?: string[];
        matches?: Record<string, TQueryBaseOptions>;
        countMatches?: string[];
      },
      values: Record<string, TValueWithUndefined>[],
    ) {
      if (options.className === 'File') throw Error('File is not support insertMany');
      QueryValidator.recursiveCheck(values);
      const _validator = await validator();
      _validator.validateCountMatches(options.className, options.countMatches ?? []);
      const _includes = _validator.decodeIncludes(options.className, options.includes ?? ['*']);
      const _matches = _validator.decodeMatches(options.className, options.matches ?? {}, _includes);
      if (!_validator.validateCLPs(options.className, 'create')) throw Error('No permission');
      const _attrs = normalize(_.map(values, attr => _validator.validateFields(options.className, attr, 'create', QueryValidator.patterns.path)));
      while (true) {
        try {
          return await proto.storage.atomic(
            (storage) => storage.insertMany({
              className: options.className,
              includes: _includes,
              matches: _matches,
              countMatches: options.countMatches ?? [],
              objectIdSize: proto[PVK].options.objectIdSize
            }, _attrs),
            { lockTable: options.className, retry: true },
          );
        } catch (e) {
          if (proto.storage.isDuplicateIdError(e)) continue;
          throw e;
        }
      }
    },
    async updateOne(
      query: FindOneOptions,
      update: Record<string, TUpdateOp>
    ) {
      QueryValidator.recursiveCheck(query, update);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'update')) throw Error('No permission');
      return proto.storage.atomic((storage) => storage.updateOne(
        _validator.decodeQuery(normalize(query), 'update'),
        normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path)),
      ));
    },
    async updateMany(
      query: FindOptions,
      update: Record<string, TUpdateOp>
    ) {
      QueryValidator.recursiveCheck(query, update);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'update')) throw Error('No permission');
      return proto.storage.atomic((storage) => storage.updateMany(
        _validator.decodeQuery(normalize(query), 'update'),
        normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path)),
      ));
    },
    async upsertOne(
      query: FindOneOptions,
      update: Record<string, TUpdateOp>,
      setOnInsert: Record<string, TValueWithUndefined>
    ) {
      if (query.className === 'File') throw Error('File is not support upsertOne');
      QueryValidator.recursiveCheck(query, update, setOnInsert);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'create', 'update')) throw Error('No permission');
      const _query = _validator.decodeQuery(normalize(query), 'update');
      const _update = normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path));
      const _setOnInsert = normalize(_validator.validateFields(query.className, setOnInsert, 'create', QueryValidator.patterns.path));
      while (true) {
        try {
          return await proto.storage.atomic(
            (storage) => storage.upsertOne(_query, _update, _setOnInsert),
            { lockTable: query.className, retry: true },
          );
        } catch (e) {
          if (proto.storage.isDuplicateIdError(e)) continue;
          throw e;
        }
      }
    },
    async upsertMany(
      query: FindOptions,
      update: Record<string, TUpdateOp>,
      setOnInsert: Record<string, TValueWithUndefined>
    ) {
      if (query.className === 'File') throw Error('File is not support upsertOne');
      QueryValidator.recursiveCheck(query, update, setOnInsert);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'create', 'update')) throw Error('No permission');
      const _query = _validator.decodeQuery(normalize(query), 'update');
      const _update = normalize(_validator.validateFields(query.className, update, 'update', QueryValidator.patterns.path));
      const _setOnInsert = normalize(_validator.validateFields(query.className, setOnInsert, 'create', QueryValidator.patterns.path));
      while (true) {
        try {
          return await proto.storage.atomic(
            (storage) => storage.upsertMany(_query, _update, _setOnInsert),
            { lockTable: query.className, retry: true },
          );
        } catch (e) {
          if (proto.storage.isDuplicateIdError(e)) continue;
          throw e;
        }
      }
    },
    async deleteOne(
      query: FindOneOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'delete')) throw Error('No permission');
      return proto.storage.atomic((storage) => storage.deleteOne(_validator.decodeQuery(normalize(query), 'update')));
    },
    async deleteMany(
      query: FindOptions
    ) {
      QueryValidator.recursiveCheck(query);
      const _validator = await validator();
      if (!_validator.validateCLPs(query.className, 'delete')) throw Error('No permission');
      return proto.storage.atomic((storage) => storage.deleteMany(_validator.decodeQuery(normalize(query), 'update')));
    },
  };
};

