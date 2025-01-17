//
//  types.ts
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

import { TFileStorage } from '../file';
import { TStorage } from '../storage';
import { TSchema } from '../../internals/schema';
import { CookieOptions, Request } from '@o2ter/server-js';
import { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { PasswordHashOptions } from '../crypto/password';
import { TExtensions } from '../../internals/object/types';
import { TPubSub } from '../pubsub';
import { TUser } from '../../internals/object/user';
import { TRole } from '../../internals/object/role';
import { Awaitable } from '@o2ter/utils-js';
import { ProtoService } from './index';

export type ProtoServiceOptions<Ext> = {
  /**
   * The endpoint for the service.
   */
  endpoint: string;

  /**
   * The schema definitions for the service.
   */
  schema: Record<string, TSchema>;

  /**
   * User resolver configuration.
   */
  userResolver?: (proto: ProtoService<Ext>, user?: TUser) => Awaitable<TUser | undefined>;

  /**
   * Role resolver configuration.
   */
  roleResolver?: {
    /**
     * Keys to inherit roles.
     */
    inheritKeys?: string[];

    /**
     * Custom resolver function for roles.
     * @param user The user object.
     * @param defaultResolver The default resolver function.
     * @returns A promise that resolves to an array of roles.
     */
    resolver?: (
      user: TUser,
      defaultResolver: () => Promise<TRole[]>,
    ) => Awaitable<TRole[]>;
  };

  /**
   * Storage configuration.
   */
  storage: TStorage;

  /**
   * File storage configuration.
   */
  fileStorage: TFileStorage;

  /**
   * Pub/Sub configuration.
   */
  pubsub?: TPubSub;

  /**
   * Class extensions configuration.
   */
  classExtends?: TExtensions<Ext>;

  /**
   * Size of the object ID.
   */
  objectIdSize?: number;

  /**
   * Maximum fetch limit.
   */
  maxFetchLimit?: number;

  /**
   * Maximum upload size.
   */
  maxUploadSize?: number;

  /**
   * Cookie options.
   */
  cookieOptions?: CookieOptions;

  /**
   * JWT sign options.
   */
  jwtSignOptions?: SignOptions;

  /**
   * JWT verify options.
   */
  jwtVerifyOptions?: VerifyOptions;

  /**
   * JWT upload sign options.
   */
  jwtUploadSignOptions?: SignOptions;

  /**
   * JWT upload verify options.
   */
  jwtUploadVerifyOptions?: VerifyOptions;

  /**
   * Password hash options.
   */
  passwordHashOptions?: PasswordHashOptions;
};

export type ProtoServiceKeyOptions = {
  /**
   * JWT token for the service.
   */
  jwtToken: string;

  /**
   * Master users configuration.
   */
  masterUsers?: { 
    /**
     * Username of the master user.
     */
    user: string; 

    /**
     * Password of the master user.
     */
    pass: string; 
  }[];
};
