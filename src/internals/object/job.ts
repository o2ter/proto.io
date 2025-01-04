//
//  job.ts
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
import { TValue } from '../types';
import { TUser } from './user';

/**
 * Class representing a Job.
 * @extends TObject
 */
export class TJob extends TObject {

  constructor(
    attributes?: Record<string, TValue> | ((self: TObject) => Record<string, TValue>),
  ) {
    super('_Job', attributes);
  }

  /**
   * Get the name of the job.
   * @return {string} The name of the job.
   */
  get name(): string {
    return this.get('name');
  }

  /**
   * Get the data of the job.
   * @return {TValue | undefined} The data of the job.
   */
  get data(): TValue | undefined {
    return this.get('data');
  }

  /**
   * Get the user associated with the job.
   * @return {TUser | undefined} The user associated with the job.
   */
  get user(): TUser | undefined {
    return this.get('user');
  }

  /**
   * Get the error of the job.
   * @return {TValue | undefined} The error of the job.
   */
  get error(): TValue | undefined {
    return this.get('error');
  }

  /**
   * Get the start time of the job.
   * @return {Date | undefined} The start time of the job.
   */
  get startedAt(): Date | undefined {
    return this.get('startedAt');
  }

  /**
   * Get the completion time of the job.
   * @return {Date | undefined} The completion time of the job.
   */
  get completedAt(): Date | undefined {
    return this.get('completedAt');
  }
}