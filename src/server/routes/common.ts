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
import { Response } from 'express';
import { IOSerializable, serialize } from '../../codec';
import { IOObject } from '../../types/object';
import { objectMethods } from '../../types/object/methods';
import { Proto } from '../../server';

export const response = async <T extends IOSerializable<IOObject>>(
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
}

export const applyIOObjectMethods = (data: IOSerializable<IOObject>, proto: Proto): IOSerializable<IOObject> => {
  if (data instanceof IOObject) return objectMethods(data, proto) as IOObject;
  if (_.isArray(data)) return _.map(data, x => applyIOObjectMethods(x, proto));
  if (_.isPlainObject(data)) return _.mapValues(data as any, x => applyIOObjectMethods(x, proto));
  return data;
}
