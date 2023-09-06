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

export const _Blob = typeof Blob !== 'undefined' ? Blob : require('node:buffer').Blob as NodeBlob;

export type FileBuffer = ArrayBuffer | ArrayBufferView;
export type FileStream = ReadableStream | Readable;
export type FileData = string | typeof _Blob | FileBuffer | FileStream | { base64: string; };

export const isBlob = (x: any): x is typeof _Blob => {
  return typeof Blob !== 'undefined' ? x instanceof Blob : x instanceof require('node:buffer').Blob;
};

export const blobToArrayBuffer = (x: typeof _Blob): Promise<ArrayBuffer> => {
  if (typeof Blob !== 'undefined' && x instanceof Blob) return x.arrayBuffer();
  return (x as NodeBlob).arrayBuffer();
};

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
  if (typeof Buffer !== 'undefined' && buffer instanceof Buffer) return Buffer.from(buffer).toString('base64');
  if (ArrayBuffer.isView(buffer)) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return _bufferToBase64(buffer);
}