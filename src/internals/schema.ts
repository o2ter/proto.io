//
//  schema.ts
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
import { _TValue } from './types';

export namespace TSchema {
  export type ACL = string[];
  export type ACLs = { read: TSchema.ACL; update: TSchema.ACL; };
  export type Primitive = 'boolean' | 'number' | 'decimal' | 'string' | 'date' | 'object' | 'array';
  export type PrimitiveType = Primitive | { type: Primitive; default?: _TValue; };
  export type VectorType = { type: 'vector'; dimension: number; default?: number[]; };
  export type ShapeType = { type: 'shape'; shape: Record<string, DataType>; };
  export type Relation = 'pointer' | 'relation';
  export type PointerType = { type: 'pointer'; target: string; };
  export type RelationType = { type: 'relation'; target: string; foreignField?: string; };
  export type DataType = PrimitiveType | VectorType | ShapeType | PointerType | RelationType;
  export type CLPs = {
    get?: TSchema.ACL;
    find?: TSchema.ACL;
    count?: TSchema.ACL;
    create?: TSchema.ACL;
    update?: TSchema.ACL;
    delete?: TSchema.ACL;
  };
  export type FLPs = {
    read?: TSchema.ACL;
    create?: TSchema.ACL;
    update?: TSchema.ACL;
  };
  export type Indexes = {
    type?: 'basic';
    keys: Record<string, 1 | -1>;
    unique?: boolean;
  } | {
    type: 'vector';
    keys: string[];
  };
}

export const isPrimitive = (x: TSchema.DataType): x is TSchema.PrimitiveType => _.isString(x) || (x.type !== 'pointer' && x.type !== 'relation' && x.type !== 'shape');
export const isVector = (x: TSchema.DataType): x is TSchema.VectorType => !_.isString(x) && x.type === 'vector';
export const dimensionOf = (x: TSchema.DataType) => isVector(x) ? x.dimension : 0;
export const isShape = (x: TSchema.DataType): x is TSchema.ShapeType => !_.isString(x) && x.type === 'shape';
export const isPointer = (x: TSchema.DataType): x is TSchema.PointerType => !_.isString(x) && x.type === 'pointer';
export const isRelation = (x: TSchema.DataType): x is TSchema.RelationType => !_.isString(x) && x.type === 'relation';
export const _typeof = (x: TSchema.DataType) => _.isString(x) ? x : x.type !== 'pointer' && x.type !== 'relation' ? x.type : x.target;

export const shapePaths = (x: TSchema.ShapeType): {
  path: string,
  type: Exclude<TSchema.DataType, TSchema.ShapeType>,
}[] => _.flatMap(x.shape, (v, k) => (
  isShape(v) ? _.map(shapePaths(v), x => ({ path: `${k}.${x.path}`, type: x.type })) : { path: k, type: v }
));

export interface TSchema {
  fields: Record<string, TSchema.DataType>;
  classLevelPermissions?: TSchema.CLPs;
  fieldLevelPermissions?: Record<string, TSchema.FLPs>;
  secureFields?: string[];
  indexes?: TSchema.Indexes[];
}

export const defaultObjectKeyTypes: Record<string, TSchema.DataType> = {
  _id: 'string',
  __v: 'number',
  _created_at: 'date',
  _updated_at: 'date',
  _expired_at: 'date',
  _rperm: 'array',
  _wperm: 'array',
};

export const defaultObjectReadonlyKeys = ['_id', '__v', '_created_at', '_updated_at'];
export const defaultObjectKeys = [...defaultObjectReadonlyKeys, '_expired_at', '_rperm', '_wperm'];
