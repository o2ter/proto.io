//
//  index.ts
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
import path from 'path';
import fs from 'fs/promises';
import { ProtoService } from '../../../server/proto';
import { FileStorageOptions } from '../base';
import { FileChunkStorageBase } from '../base/chunk';

export class FileSystemStorage extends FileChunkStorageBase<string> {

  volumn: string;

  constructor(volumn: string, options: FileStorageOptions = {}) {
      super(options);
    this.volumn = volumn;
  }

  async createChunk<E>(proto: ProtoService<E>, token: string, start: number, end: number, compressed: Buffer) {
    const directory = path.resolve(this.volumn, token);
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch { }
    await fs.writeFile(path.join(directory, `${start}.chunk`), compressed);
  }

  async* listChunks<E>(proto: ProtoService<E>, token: string, start?: number, end?: number) {
    const directory = path.resolve(this.volumn, token);
    const files = _.filter(await fs.readdir(directory), x => !!x.match(/^\d+\.chunk$/));
    for (const file of files) {
      const pos = parseInt(file.slice(0, -6));
      if (start && pos < start) continue;
      if (end && pos >= end) continue;
      yield { start: pos, file: path.resolve(directory, file) };
    }
  }

  async readChunk<E>(proto: ProtoService<E>, file: string) {
    return fs.readFile(file);
  }

  async destroy<E>(proto: ProtoService<E>, token: string) {
    try {
      const directory = path.resolve(this.volumn, token);
      await fs.rm(directory, { recursive: true, force: true });
    } catch { }
  }
};

export default FileSystemStorage;