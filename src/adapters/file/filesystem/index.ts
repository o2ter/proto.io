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
import FileStorageBase, { FileStorageOptions } from '../base';

export class FileSystemStorage extends FileStorageBase {

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

  async* readChunks<E>(proto: ProtoService<E>, token: string, start?: number | undefined, end?: number | undefined) {
    const directory = path.resolve(this.volumn, token);
    const _files = _.filter(await fs.readdir(directory), x => !!x.match(/^\d+\.chunk$/));
    const files = _.orderBy(_.map(_files, x => ({
      path: path.resolve(directory, x),
      start: parseInt(x.slice(0, -6)),
    })), x => x.start);
    for (const [chunk, endBytes] of _.zip(files, _.slice(_.map(files, x => x.start), 1))) {
      if (_.isNumber(start) && _.isNumber(endBytes) && start >= endBytes) continue;
      if (_.isNumber(end) && end <= chunk!.start) continue;
      yield {
        start: chunk!.start,
        data: fs.readFile(chunk!.path),
      };
    }
  }

  async destroy<E>(proto: ProtoService<E>, token: string) {
    try {
      const directory = path.resolve(this.volumn, token);
      await fs.rm(directory, { recursive: true, force: true });
    } catch { }
  }
};

export default FileSystemStorage;