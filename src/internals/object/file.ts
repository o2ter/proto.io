//
//  file.ts
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
import { TObject } from './index';
import { ExtraOptions } from '../options';
import { FileStream } from '../buffer';
import { TValue } from '../types';

/**
 * Interface representing a file.
 */
export interface TFile {
  /**
   * URL of the file.
   */
  url: string | undefined;

  /**
   * Retrieves the file data.
   * @param options - Optional extra options.
   * @returns A FileStream containing the file data.
   */
  fileData(options?: ExtraOptions<boolean>): FileStream;

  /**
   * Saves the file.
   * @param options - Optional extra options including cascadeSave and uploadToken.
   * @returns A promise that resolves to the current instance.
   */
  save(options?: ExtraOptions<boolean> & {
    cascadeSave?: boolean;
    uploadToken?: string;
  }): PromiseLike<this>;
}

/**
 * Class representing a file.
 */
export class TFile extends TObject {

  constructor(
    attributes?: Record<string, TValue> | ((self: TObject) => Record<string, TValue>),
  ) {
    super('File', attributes);
  }

  /**
   * Gets the filename of the file.
   * @returns The filename.
   */
  get filename(): string | undefined {
    return this.get('filename');
  }

  /**
   * Gets the size of the file.
   * @returns The size of the file.
   */
  get size(): number | undefined {
    return this.get('size');
  }

  /**
   * Gets the type of the file.
   * @returns The type of the file.
   */
  get type(): string | undefined {
    return this.get('type');
  }

  /**
   * Gets the token of the file.
   * @returns The token of the file.
   */
  get token(): string | undefined {
    return this.get('token');
  }

}
