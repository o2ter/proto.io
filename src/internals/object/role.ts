//
//  role.ts
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
import { TObject } from './index';
import { TValue } from '../types';
import { TUser } from './user';

/**
 * Class representing a Role.
 * @extends TObject
 */
export class TRole extends TObject {

  constructor(
    attributes?: Record<string, TValue> | ((self: TObject) => Record<string, TValue>),
  ) {
    super('Role', attributes);
  }

  /**
   * Get the name of the role.
   * @return {string | undefined} The name of the role.
   */
  get name(): string | undefined {
    return this.get('name');
  }

  /**
   * Get the users associated with the role.
   * @return {TUser[]} The users associated with the role.
   */
  get users(): TUser[] {
    return this.get('users') ?? [];
  }

  /**
   * Set the users associated with the role.
   * @param {TUser[]} value - The users to associate with the role.
   */
  set users(value: TUser[]) {
    this.set('users', value);
  }

  /**
   * Get the roles associated with the role.
   * @return {TRole[]} The roles associated with the role.
   */
  get roles(): TRole[] {
    return this.get('roles') ?? [];
  }

  /**
   * Set the roles associated with the role.
   * @param {TRole[]} value - The roles to associate with the role.
   */
  set roles(value: TRole[]) {
    this.set('roles', value);
  }
}