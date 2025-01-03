//
//  schema.ts
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
import { _TValue } from './types';

export namespace TSchema {
  /**
   * Access Control List represented as an array of strings.
   */
  export type ACL = string[];

  /**
   * Access Control Lists for read and update operations.
   */
  export type ACLs = { 
    /**
     * ACL for read operation.
     */
    read: TSchema.ACL; 

    /**
     * ACL for update operation.
     */
    update: TSchema.ACL; 
  };

  /**
   * Primitive data types.
   */
  export type Primitive = 'boolean' | 'number' | 'decimal' | 'string' | 'string[]' | 'date' | 'object' | 'array';

  /**
   * Primitive type with an optional default value.
   */
  export type PrimitiveType = Primitive | { 
    /**
     * The type of the primitive.
     */
    type: Primitive; 

    /**
     * Optional default value.
     */
    default?: _TValue; 
  };

  /**
   * Vector type with a specified dimension and an optional default value.
   */
  export type VectorType = { 
    /**
     * The type of the vector.
     */
    type: 'vector'; 

    /**
     * The dimension of the vector.
     */
    dimension: number; 

    /**
     * Optional default value.
     */
    default?: number[]; 
  };

  /**
   * Shape type with a specified shape.
   */
  export type ShapeType = { 
    /**
     * The type of the shape.
     */
    type: 'shape'; 

    /**
     * The shape definition.
     */
    shape: Record<string, DataType>; 
  };

  /**
     * Pointer type with a target.
     */
  export type PointerType = { 
    /**
     * The type of the pointer.
     */
    type: 'pointer'; 

    /**
     * The target class of the pointer.
     */
    target: string; 
  };

  /**
   * Relation type with a target and an optional foreign field.
   */
  export type RelationType = { 
    /**
     * The type of the relation.
     */
    type: 'relation'; 

    /**
     * The target class of the relation.
     */
    target: string; 

    /**
     * Optional foreign field.
     */
    foreignField?: string; 
  };

  /**
   * Data type which can be a primitive, vector, shape, pointer, or relation type.
   */
  export type DataType = PrimitiveType | VectorType | ShapeType | PointerType | RelationType;

  /**
   * Class Level Permissions.
   */
  export type CLPs = {
    /**
     * ACL for get operation.
     */
    get?: TSchema.ACL;

    /**
     * ACL for find operation.
     */
    find?: TSchema.ACL;

    /**
     * ACL for count operation.
     */
    count?: TSchema.ACL;

    /**
     * ACL for create operation.
     */
    create?: TSchema.ACL;

    /**
     * ACL for update operation.
     */
    update?: TSchema.ACL;

    /**
     * ACL for delete operation.
     */
    delete?: TSchema.ACL;
  };

  /**
   * Field Level Permissions.
   */
  export type FLPs = {
    /**
     * ACL for read operation.
     */
    read?: TSchema.ACL;

    /**
     * ACL for create operation.
     */
    create?: TSchema.ACL;

    /**
     * ACL for update operation.
     */
    update?: TSchema.ACL;
  };

  /**
   * Indexes for the schema.
   */
  export type Indexes = {
    /**
     * Type of the index, default is 'basic'.
     */
    type?: 'basic';

    /**
     * Keys for the index.
     */
    keys: Record<string, 1 | -1>;

    /**
     * Whether the index is unique.
     */
    unique?: boolean;
  } | {
    /**
     * Type of the index, must be 'vector'.
     */
    type: 'vector';

    /**
     * Keys for the vector index.
     */
    keys: string | string[];

    /**
     * Method for the vector index.
     */
    method?: 'hnsw' | 'ivfflat';
  };
}

export const _isTypeof = (x: TSchema.DataType, types: string | string[]) => {
  if (_.isString(x)) return _.includes(_.castArray(types), x);
  return _.includes(_.castArray(types), x.type);
};
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
  /**
   * Fields of the schema, where each field is a data type.
   */
  fields: Record<string, TSchema.DataType>;

  /**
   * Class level permissions for the schema.
   */
  classLevelPermissions?: TSchema.CLPs;

  /**
   * Additional object permissions for the schema.
   */
  additionalObjectPermissions?: TSchema.ACLs;

  /**
   * Field level permissions for the schema, where each field can have its own permissions.
   */
  fieldLevelPermissions?: Record<string, TSchema.FLPs>;

  /**
   * Secure fields in the schema.
   */
  secureFields?: string[];

  /**
   * Indexes for the schema.
   */
  indexes?: TSchema.Indexes[];
}

export const defaultObjectKeyTypes: Record<string, TSchema.DataType> = {
  _id: 'string',
  __v: 'number',
  __i: 'number',
  _created_at: 'date',
  _updated_at: 'date',
  _expired_at: 'date',
  _rperm: 'string[]',
  _wperm: 'string[]',
};

export const defaultObjectReadonlyKeys = ['_id', '__v', '__i', '_created_at', '_updated_at'];
export const defaultObjectKeys = [...defaultObjectReadonlyKeys, '_expired_at', '_rperm', '_wperm'];
