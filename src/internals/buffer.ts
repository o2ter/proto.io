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

export type FileBuffer = ArrayBuffer | ArrayBufferView;
export type FileStream = ReadableStream | Readable;
export type FileData = string | FileBuffer | FileStream | { base64: string; };

export const isFileBuffer = (x: any): x is FileBuffer => {
  if (_.isArrayBuffer(x) || ArrayBuffer.isView(x)) return true;
  return false;
};

export const isFileStream = (x: any): x is FileStream => {
  if (typeof ReadableStream !== 'undefined' && x instanceof ReadableStream) return true;
  if (typeof window === 'undefined' && x instanceof require('node:stream').Readable) return true;
  return false;
};

export const base64ToBuffer = typeof window === 'undefined' ?
  (base64: string) => Buffer.from(base64, 'base64') :
  (base64: string) => Uint8Array.from(window.atob(base64), x => x.codePointAt(0) as number);

const _stringToBase64 = typeof window === 'undefined' ?
  (buffer: string) => Buffer.from(buffer).toString('base64') :
  (buffer: string) => window.btoa(buffer);

const _bufferToBase64 = typeof window === 'undefined' ?
  (buffer: ArrayBufferLike) => Buffer.from(buffer).toString('base64') :
  (buffer: ArrayBufferLike) => window.btoa(String.fromCharCode(...new Uint8Array(buffer)));

export const bufferToBase64 = (buffer: string | FileBuffer) => {
  if (_.isString(buffer)) return _stringToBase64(buffer);
  if (ArrayBuffer.isView(buffer)) buffer = buffer.buffer;
  return _bufferToBase64(buffer);
}