//
//  hmac.ts
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
import { binaryToBuffer } from '../buffer';

const enc = new TextEncoder();

const algMap = {
  'sha1': 'SHA-1',
  'sha256': 'SHA-256',
  'sha384': 'SHA-384',
  'sha512': 'SHA-512',
};

const WebHamc = async (
  alg: keyof typeof algMap,
  secret: BinaryData | string,
  data: BinaryData | string,
) => {
  const algorithm = { name: 'HMAC', hash: algMap[alg] };
  const _secret = _.isString(secret) ? enc.encode(secret) : secret;
  const _data = _.isString(data) ? enc.encode(data) : data;
  const key = await window.crypto.subtle.importKey('raw', _secret, algorithm, false, ['sign']);
  return crypto.subtle.sign(algorithm.name, key, _data);
}

const NodeHamc = async (
  alg: keyof typeof algMap,
  secret: BinaryData | string,
  data: BinaryData | string,
) => {
  const { createHmac } = await import('crypto');
  const _secret = _.isString(secret) ? enc.encode(secret) : secret;
  const _data = _.isString(data) ? enc.encode(data) : data;
  const hmac = createHmac(alg, binaryToBuffer(_secret));
  hmac.update(binaryToBuffer(_data));
  return hmac.digest();
}

export const Hamc = typeof window === 'undefined' ? NodeHamc : WebHamc;