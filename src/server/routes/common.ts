//
//  common.ts
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
import { Readable } from 'node:stream';
import { Request, Response } from 'express';
import { TSerializable, serialize } from '../../internals';
import busboy, { FileInfo } from 'busboy';

export const response = async <T extends TSerializable>(
  res: Response,
  callback: () => Promise<T | undefined>,
) => {

  try {

    const data = await callback();
    res.type('application/json').send(serialize(data ?? null));

  } catch (error) {

    if (error instanceof String) {
      res.status(400).json({ message: error });
    } else if (error instanceof Error) {
      res.status(400).json({ ...error, message: error.message });
    } else {
      res.status(400).json(error);
    }
  }
};

export const decodeFormStream = (
  req: Request,
  onFile: (file: Readable, info: FileInfo) => PromiseLike<any>
) => {

  const formData = busboy(req);
  const data: Record<string, any> = {};

  formData.on('field', (name, val) => { data[name] = val; });
  formData.on('file', async (name, file, info) => {
    try {
      data[name] = await onFile(file, info);
      if (!file.readableEnded) throw Error('Incomplete read');
    } catch (e) {
      formData.emit('error', e);
    }
  });

  const result = new Promise<Record<string, any>>((resolve, reject) => {
    formData.on('close', () => { resolve(data); });
    formData.on('error', (error) => { reject(error); });
  });

  req.pipe(formData);
  return result;
};
