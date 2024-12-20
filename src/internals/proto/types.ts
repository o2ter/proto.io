//
//  types.ts
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

import { Awaitable } from '@o2ter/utils-js';
import { ProtoService } from '../../server/proto';
import { TSerializable } from '../../common/codec';
import { TObjectType } from '../object/types';

/**
 * A callback function type.
 * @param request - The request object.
 * @returns An awaitable response.
 */
type Callback<T, R, E> = (request: ProtoService<E> & T) => Awaitable<R>;

/**
 * A callback function type.
 * @param request - The request object.
 * @returns An awaitable response.
 */
export type ProtoFunction<E> = Callback<{ params: TSerializable; }, void | TSerializable, E>;

/**
 * Validator options for proto functions.
 */
type Validator = {
  /**
   * Indicates if a user is required.
   */
  requireUser?: boolean;

  /**
   * Indicates if a master user is required.
   */
  requireMaster?: boolean;

  /**
   * Indicates if any user roles are required.
   */
  requireAnyUserRoles?: string[];

  /**
   * Indicates if all user roles are required.
   */
  requireAllUserRoles?: string[];
};

/**
 * Options for configuring a proto function.
 */
export type ProtoFunctionOptions<E> = {
  /**
   * The callback function for the proto function.
   */
  callback: ProtoFunction<E>;

  /**
   * Optional validator for the proto function.
   */
  validator?: Validator;
};
