//
//  password.ts
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
import { scrypt, BinaryLike, ScryptOptions } from 'node:crypto';
import { promisify } from 'util';
import { randomBytes } from '@o2ter/crypto-js';

const _scrypt = promisify<BinaryLike, BinaryLike, number, ScryptOptions, Buffer>(scrypt);

type _PasswordHashOptions = {
  'scrypt': {
    log2n: number;
    blockSize: number;
    parallel: number;
    keySize: number;
    saltSize: number;
  };
};

export type PasswordHashOptions = {
  [K in keyof _PasswordHashOptions]: { alg: K } & _PasswordHashOptions[K];
}[keyof _PasswordHashOptions];

const _passwordHash = async <T extends keyof _PasswordHashOptions>(
  alg: T,
  password: string,
  salt: Buffer | Uint8Array,
  options: _PasswordHashOptions[T],
) => {
  switch (alg) {
    case 'scrypt':

      if (!_.isSafeInteger(options.log2n)) throw Error('Invalid options');
      if (!_.isSafeInteger(options.blockSize)) throw Error('Invalid options');
      if (!_.isSafeInteger(options.parallel)) throw Error('Invalid options');
      if (!_.isSafeInteger(options.keySize)) throw Error('Invalid options');
      if (!_.isSafeInteger(options.saltSize)) throw Error('Invalid options');

      const _opts: ScryptOptions = {
        N: 1 << options.log2n,
        blockSize: options.blockSize,
        parallelization: options.parallel,
      };

      const derivedKey = await _scrypt(password, salt, options.keySize, _opts);

      return derivedKey.toString('base64');

    default: throw Error('Invalid algorithm');
  }
}

export const passwordHash = async <T extends keyof _PasswordHashOptions>(
  alg: T,
  password: string,
  options: _PasswordHashOptions[T],
) => {
  const salt = randomBytes(options.saltSize);
  return {
    alg,
    salt: salt.toString('base64'),
    derivedKey: await _passwordHash(alg, password, salt, options),
    ...options
  };
}

export const verifyPassword = async <T extends keyof _PasswordHashOptions>(
  alg: T,
  password: string,
  options: _PasswordHashOptions[T] & { salt: string; derivedKey: string; },
) => {
  if (!_.isString(options.salt)) return false;
  if (!_.isString(options.derivedKey)) return false;
  try {
    return options.derivedKey === await _passwordHash(alg, password, Buffer.from(options.salt, 'base64'), options);
  } catch {
    return false;
  }
}