//
//  password.ts
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

import _ from 'lodash';
import { scrypt, BinaryLike, ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';
import { randomBytes } from './random';

export type PasswordHashOptions = {
  'scrypt': {
     log2n: number;
     blockSize: number;
     parallel: number;
     keySize: number;
     saltSize: number;
  };
};

export const passwordHash = async <T extends keyof PasswordHashOptions>(
  alg: T,
  password: string,
  options: PasswordHashOptions[T],
) => {
  switch (alg) {
    case 'scrypt':

    if (!_.isInteger(options.log2n)) throw Error('Invalid options');
    if (!_.isInteger(options.blockSize)) throw Error('Invalid options');
    if (!_.isInteger(options.parallel)) throw Error('Invalid options');
    if (!_.isInteger(options.keySize)) throw Error('Invalid options');
    if (!_.isInteger(options.saltSize)) throw Error('Invalid options');

    const _opts: ScryptOptions = {
      N: 1 << options.log2n,
      blockSize: options.blockSize,
      parallelization: options.parallel,
    };

    const salt = randomBytes(options.saltSize);
    const derivedKey = await promisify<BinaryLike, BinaryLike, number, ScryptOptions>(scrypt)(password, salt, options.keySize, _opts);

    return { alg, salt, derivedKey, ...options };

    default: throw Error('Invalid algorithm');
  }
}