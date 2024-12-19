//
//  index.ts
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
import { ProtoService } from '../proto/index';
import { TSchema } from '../../internals/schema';
import { BinaryData } from '@o2ter/utils-js';

/**
 * Represents file information.
 */
export type TFileInfo = {
  /**
   * The MIME type of the file.
   */
  mimeType?: string;

  /**
   * The filename.
   */
  filename?: string;
};

/**
 * Interface for file storage operations.
 */
export interface TFileStorage {

  /**
   * The schema definition for the file storage.
   */
  schema: Record<string, TSchema>;

  /**
   * Creates a new file in the storage.
   * @param proto - The ProtoService instance.
   * @param stream - The binary data stream or async iterable of binary data.
   * @param info - The file information.
   * @param maxUploadSize - The maximum upload size.
   * @returns A promise that resolves to an object containing the file ID and size.
   */
  create<E>(
    proto: ProtoService<E>,
    stream: BinaryData | AsyncIterable<BinaryData>,
    info: TFileInfo,
    maxUploadSize: number,
  ): PromiseLike<{ _id: string; size: number; }>;

  /**
   * Destroys a file in the storage.
   * @param proto - The ProtoService instance.
   * @param id - The ID of the file to destroy.
   * @returns A promise that resolves when the file is destroyed.
   */
  destroy<E>(proto: ProtoService<E>, id: string): PromiseLike<void>;

  /**
   * Retrieves file data from the storage.
   * @param proto - The ProtoService instance.
   * @param id - The ID of the file.
   * @param start - The optional start byte position.
   * @param end - The optional end byte position.
   * @returns An async iterable of binary data.
   */
  fileData<E>(proto: ProtoService<E>, id: string, start?: number, end?: number): AsyncIterable<BinaryData>;

}