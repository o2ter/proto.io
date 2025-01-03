//
//  defaults.ts
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
import { TSchema } from '../../internals/schema';

export const defaultSchema: Record<string, TSchema> = {
  'User': {
    fields: {
      password: 'object',
    },
    classLevelPermissions: {
      find: [],
      count: [],
      delete: [],
    },
    fieldLevelPermissions: {
      _expired_at: { create: [], update: [] },
    },
    secureFields: ['password'],
  },
  'Role': {
    fields: {
      name: 'string',
      users: { type: 'relation', target: 'User' },
      roles: { type: 'relation', target: 'Role' },
    },
    classLevelPermissions: {
      create: [],
      update: [],
      delete: [],
    },
    fieldLevelPermissions: {
      _expired_at: { create: [], update: [] },
    },
    indexes: [
      {
        keys: { name: 1 },
        unique: true,
      },
    ],
  },
  'File': {
    fields: {
      filename: 'string',
      size: 'number',
      type: 'string',
      token: 'string',
      nonce: 'string',
    },
    classLevelPermissions: {
      find: [],
      count: [],
      update: [],
      delete: [],
    },
    fieldLevelPermissions: {
      size: { update: [] },
      type: { update: [] },
      token: { update: [] },
      nonce: { update: [] },
      _expired_at: { create: [], update: [] },
    },
    indexes: [
      {
        keys: { token: 1 },
        unique: true,
      },
      {
        keys: { nonce: 1 },
        unique: true,
      },
    ],
  },
  '_Job': {
    fields: {
      name: 'string',
      data: 'object',
      error: 'object',
      user: { type: 'pointer', target: 'User' },
      startedAt: 'date',
      completedAt: 'date',
      locks: { type: 'relation', target: '_JobScope', foreignField: 'job' },
    },
    classLevelPermissions: {
      get: [],
      find: [],
      count: [],
      create: [],
      update: [],
      delete: [],
    },
    fieldLevelPermissions: {
      name: { update: [] },
      data: { update: [] },
      error: { update: [] },
      user: { update: [] },
      startedAt: { create: [], update: [] },
      completedAt: { create: [], update: [] },
      _expired_at: { create: [], update: [] },
    },
    indexes: [
      { keys: { completedAt: 1, _created_at: 1 } },
    ],
  },
  '_JobScope': {
    fields: {
      scope: 'string',
      job: { type: 'pointer', target: '_Job' },
    },
    classLevelPermissions: {
      get: [],
      find: [],
      count: [],
      create: [],
      update: [],
      delete: [],
    },
    fieldLevelPermissions: {
      scope: { update: [] },
      job: { update: [] },
      _expired_at: { create: [], update: [] },
    },
    indexes: [
      {
        keys: { scope: 1 },
        unique: true,
      },
    ],
  },
}
