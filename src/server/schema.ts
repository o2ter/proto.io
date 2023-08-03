//
//  schema.ts
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

import { _TValue } from '../internals';

export namespace TSchema {
  export type ACL = string[];
  export type ACLs = { read?: TSchema.ACL; update?: TSchema.ACL; };
  export type Primitive = 'boolean' | 'number' | 'decimal' | 'string' | 'date' | 'object' | 'array';
  export type Relation = 'pointer' | 'relation';
  export type RelationType = { type: 'relation'; target: string; foreignField?: string; };
  export type DataType = Primitive | { type: Primitive; default?: _TValue; } | { type: 'pointer'; target: string; } | RelationType;
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
    keys: Record<string, 1 | -1>;
    unique?: boolean;
  };
}

export interface TSchema {
  fields: Record<string, TSchema.DataType>;
  classLevelPermissions?: TSchema.CLPs;
  fieldLevelPermissions?: Record<string, TSchema.FLPs>;
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
