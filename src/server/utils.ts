//
//  utils.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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
import { isPrimitive, isShape, isVector, TSchema } from './../internals/schema';
import { TValueWithUndefined } from '../internals/types';
import { isPrimitiveValue, TObject } from '../internals/object';

const _resolveDataType = (
  schema: Record<string, TSchema> | undefined,
  fields: Record<string, TSchema.DataType>,
  path: string
) => {
  let last;
  for (const key of _.toPath(path)) {
    const dataType = fields[key];
    if (_.isNil(dataType)) throw Error(`Invalid path: ${path}`);
    if (isPrimitive(dataType) || isVector(dataType)) return dataType;
    if (isShape(dataType)) {
      fields = dataType.shape;
      last = dataType;
      continue;
    }
    if (_.isNil(schema)) return dataType;
    if (_.isNil(schema[dataType.target])) throw Error(`Invalid path: ${path}`);
    fields = schema[dataType.target].fields;
    last = dataType;
  }
  return last;
};

export const normalize = <T>(x: T): T => {
  if (_.isString(x)) return x.normalize('NFD') as T;
  if (_.isArray(x)) return _.map(x, x => normalize(x)) as T;
  if (_.isPlainObject(x)) return _.fromPairs(_.map(_.toPairs(x as object), ([k, v]) => [normalize(k), normalize(v)])) as T;
  return x;
};

export const requiredFieldGuard = (
  types: Record<string, TSchema.DataType>,
  values: Record<string, TValueWithUndefined>,
): Record<string, TValueWithUndefined> => {
  const result = { ...values };
  for (const [key, value] of Object.entries(result)) {
    const type = _resolveDataType(undefined, types, key);
    if (_.isNil(type)) throw Error(`Invalid path: ${key}`);
    if (_.isString(type)) continue;
    if (type.type === 'shape') {
      if (!_.isPlainObject(value)) throw Error(`Field "${key}" must be an object`);
      result[key] = requiredFieldGuard(type.shape, value as Record<string, TValueWithUndefined>);
    } else if ('required' in type && type.required) {
      if ('default' in type && !_.isNil(type.default)) {
        result[key] = type.default;
      } else if (_.isNil(value)) {
        throw Error(`Field "${key}" is required`);
      }
    }
  }
  return result;
};

export const recursiveCheck = (x: any, stack: any[]) => {
  if (_.indexOf(stack, x) !== -1) throw Error('Recursive data detected');
  if (_.isRegExp(x) || isPrimitiveValue(x) || x instanceof TObject) return;
  const children = _.isArray(x) ? x : _.values(x);
  children.forEach(v => recursiveCheck(v, [...stack, x]));
};

export const resolveDataType = (
  schema: Record<string, TSchema>,
  classname: string,
  path: string
) => _resolveDataType(schema, schema[classname]?.fields ?? {}, path);

export const resolveColumn = (
  schema: Record<string, TSchema>,
  className: string,
  path: string
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
};

