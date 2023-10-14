//
//  buffer.ts
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
import type { Readable } from 'node:stream';
import type { Blob as NodeBlob } from 'node:buffer';

export {
  isBinaryData,
  base64ToBuffer,
  bufferToBase64,
  binaryToBuffer,
} from '@o2ter/crypto-js';

export const _Blob = typeof Blob !== 'undefined' ? Blob : require('node:buffer').Blob as NodeBlob;

export type FileStream = ReadableStream | Readable;
export type FileData = string | typeof _Blob | BinaryData | FileStream | { base64: string; };

export const isBlob = (x: any): x is typeof _Blob => {
  return typeof Blob !== 'undefined' ? x instanceof Blob : x instanceof require('node:buffer').Blob;
};

export const isFileStream = (x: any): x is FileStream => {
  if (typeof ReadableStream !== 'undefined' && x instanceof ReadableStream) return true;
  if (typeof window === 'undefined' && x instanceof require('node:stream').Readable) return true;
  return false;
};
