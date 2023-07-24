//
//  defaults.ts
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
import { TSchema } from '../internals';

export const defaultSchema: Record<string, TSchema> = {
  '_User': {
    fields: {
      password: 'string',
    },
    classLevelPermissions: {
      find: [],
      count: [],
      delete: [],
    },
    fieldLevelPermissions: {
      password: { read: [], write: [] },
    },
  },
  '_Role': {
    fields: {
      name: 'string',
      users: { type: 'relation', target: '_User' },
      roles: { type: 'relation', target: '_Role' },
    },
    classLevelPermissions: {
      find: [],
      count: [],
      create: [],
      update: [],
      delete: [],
    },
    indexes: [
      {
        keys: { name: 1 },
        unique: true,
      },
    ],
  },
  '_File': {
    fields: {
      filename: 'string',
      size: 'number',
      type: 'string',
      token: 'string',
      content: 'string',
    },
    classLevelPermissions: {
      find: [],
      count: [],
    },
    fieldLevelPermissions: {
      size: { write: [] },
      type: { write: [] },
      token: { write: [] },
      content: { write: [] },
    },
  },
}
