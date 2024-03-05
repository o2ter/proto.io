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

import { TExtensions } from '../../internals';
import { TFileStorage } from '../file';
import { TStorage } from '../storage';
import { TSchema } from '../../internals/schema';
import { CookieOptions } from 'express';
import { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { ProtoService } from '.';
import { PasswordHashOptions } from '../crypto/password';
import { Awaitable } from '@o2ter/utils-js';

export type ProtoServiceOptions<Ext> = {
  endpoint: string;
  schema: Record<string, TSchema>;
  storage: TStorage;
  fileStorage: TFileStorage;
  classExtends?: TExtensions<Ext>;
  objectIdSize?: number;
  maxFetchLimit?: number | ((proto: ProtoService<Ext>) => Awaitable<number>);
  maxUploadSize?: number | ((proto: ProtoService<Ext>) => Awaitable<number>);
  cookieOptions?: CookieOptions;
  jwtSignOptions?: SignOptions;
  jwtVerifyOptions?: VerifyOptions;
  passwordHashOptions?: PasswordHashOptions;
};

export type ProtoServiceKeyOptions = {
  jwtToken: string;
  csrfToken?: string;
  masterUsers?: { user: string; pass: string; }[];
};
