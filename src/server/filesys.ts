//
//  filesys.ts
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
import { FileBuffer } from '../internals/buffer';
import { ProtoService } from './proto/index';
import { TSchema } from '../internals/schema';

type TFileInfo = {
  mimeType?: string;
  filename?: string;
};

export interface TFileStorage {

  schema: Record<string, TSchema>;

  create<E>(
    proto: ProtoService<E>,
    stream: FileBuffer | AsyncIterable<FileBuffer>,
    info: TFileInfo,
  ): PromiseLike<{ _id: string; size: number; }>;

  destory<E>(proto: ProtoService<E>, id: string): PromiseLike<void>;

  fileData<E>(proto: ProtoService<E>, id: string, start?: number, end?: number): AsyncIterable<FileBuffer>;

  fileLocation<E>(proto: ProtoService<E>, id: string): PromiseLike<string | undefined>;

}