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
import { TValueWithoutObject } from './types';
import { TQueryBaseOptions } from './query/base';

export namespace TSchema {
  /**
   * Access Control List (ACL).
   * 
   * An array of strings representing users or roles that have access to a resource.
   */
  export type ACL = string[];

  /**
   * Access Control Lists for read and update operations.
   * 
   * Defines separate ACLs for reading and updating an object.
   */
  export type ACLs = {
    /**
     * ACL for read operation.
     * Users or roles allowed to read the object.
     */
    read: TSchema.ACL;

    /**
     * ACL for update operation.
     * Users or roles allowed to update the object.
     */
    update: TSchema.ACL;
  };

  /**
   * Supported primitive data types.
   */
  export type Primitive =
    | 'boolean'
    | 'number'
    | 'decimal'
    | 'string'
    | 'string[]'
    | 'date'
    | 'object'
    | 'array';

  /**
   * Primitive type with optional default value.
   * 
   * Can be a string literal (e.g., 'string') or an object specifying the type and a default value.
   */
  export type PrimitiveType =
    | Primitive
    | {
      /**
       * The primitive type.
       */
      type: Primitive;

      /**
       * Optional default value for the field.
       */
      default?: TValueWithoutObject;
    };

  /**
   * Vector type with a specified dimension and optional default value.
   * 
   * Used for fields storing fixed-length numeric arrays (vectors).
   */
  export type VectorType = {
    /**
     * The type of the field. Always 'vector'.
     */
    type: 'vector';

    /**
     * The dimension (length) of the vector.
     */
    dimension: number;

    /**
     * Optional default value for the vector.
     */
    default?: number[];
  };

  /**
   * Shape type for nested objects.
   * 
   * Allows defining complex, nested object structures with their own field types.
   */
  export type ShapeType = {
    /**
     * The type of the field. Always 'shape'.
     */
    type: 'shape';

    /**
     * The shape definition, mapping field names to their data types.
     */
    shape: Record<string, DataType>;
  };

  /**
   * Pointer type for referencing another class.
   * 
   * Represents a one-to-one relationship to another object.
   */
  export type PointerType = {
    /**
     * The type of the field. Always 'pointer'.
     */
    type: 'pointer';

    /**
     * The name of the target class being referenced.
     */
    target: string;
  };

  /**
   * Relation type for referencing multiple objects in another class.
   * 
   * Represents a one-to-many or many-to-many relationship.
   * - `target`: The related class name.
   * - `foreignField`: (Optional) The field in the target class that refers back to this class.
   * - `match`: (Optional) Default match query options (filter, sort, etc.) applied when querying this relation.
   *   Only used if `foreignField` is set.
   */
  export type RelationType = {
    /**
     * The type of the field. Always 'relation'.
     */
    type: 'relation';

    /**
     * The name of the target class for this relation.
     */
    target: string;

    /**
     * (Optional) The field in the target class that refers back to this class.
     * If provided, the relation is managed via this foreign key.
     */
    foreignField?: string;

    /**
     * (Optional) Default match query options for this relation.
     * 
     * These options define default query behaviors—such as filtering, sorting, limiting results, and other query parameters—
     * that will be automatically applied when querying this relation via the specified `foreignField`.
     * 
     * Note: `match` is only applicable if `foreignField` is set. If `foreignField` is not provided, `match` will be ignored.
     */
    match?: TQueryBaseOptions;
  };

  /**
   * Data type for schema fields.
   * 
   * Can be a primitive, vector, shape, pointer, or relation type.
   */
  export type DataType =
    | PrimitiveType
    | VectorType
    | ShapeType
    | PointerType
    | RelationType;

  /**
   * Class Level Permissions (CLPs).
   * 
   * Defines access control for various operations at the class level.
   */
  export type CLPs = {
    /**
     * ACL for get (read single object) operation.
     */
    get?: TSchema.ACL;

    /**
     * ACL for find (query multiple objects) operation.
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
   * Field Level Permissions (FLPs).
   * 
   * Defines access control for individual fields.
   */
  export type FLPs = {
    /**
     * ACL for reading the field.
     */
    read?: TSchema.ACL;

    /**
     * ACL for creating the field.
     */
    create?: TSchema.ACL;

    /**
     * ACL for updating the field.
     */
    update?: TSchema.ACL;
  };

  /**
   * Index definitions for the schema.
   * 
   * Supports both basic and vector indexes.
   */
  export type Indexes = {
    /**
     * Type of the index. Default is 'basic'.
     */
    type?: 'basic';

    /**
     * Keys for the index, mapping field names to sort order (1 for ascending, -1 for descending).
     */
    keys: Record<string, 1 | -1>;

    /**
     * Whether the index is unique.
     */
    unique?: boolean;
  } | {
    /**
     * Type of the index. Must be 'vector' for vector indexes.
     */
    type: 'vector';

    /**
     * Keys for the vector index. Can be a single field or an array of fields.
     */
    keys: string | string[];

    /**
     * Method for the vector index. Supported: 'hnsw', 'ivfflat'.
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

  /**
   * Indicates if live query is enabled for the schema.
   */
  liveQuery?: boolean;
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
