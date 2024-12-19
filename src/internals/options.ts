//
//  options.ts
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

import { TSerializable } from '../common/codec';
import { ProtoService } from '../server/proto';
import { ProtoType } from './proto';

/**
 * Represents the types of triggers that can be used.
 * - 'beforeSave': Triggered before saving.
 * - 'afterSave': Triggered after saving.
 * - 'beforeDelete': Triggered before deleting.
 * - 'afterDelete': Triggered after deleting.
 */
type TriggerType = 'beforeSave' | 'afterSave' | 'beforeDelete' | 'afterDelete';

/**
 * Represents additional options that can be passed to certain methods.
 * @template M - A boolean indicating whether the master option is enabled.
 */
export type ExtraOptions<M extends boolean> = {
  /**
   * Indicates whether the master option is enabled.
   */
  master?: M;

  /**
   * The context object to be used.
   */
  context?: TSerializable;

  /**
   * Specifies the trigger type(s) to be silenced.
   */
  silent?: TriggerType | TriggerType[];

  /**
   * The session associated with the operation.
   */
  session?: ProtoType<any>;

  /**
   * An AbortSignal object that can be used to abort the operation.
   */
  abortSignal?: AbortSignal;
};

export const _serviceOf = (options?: ExtraOptions<any>) => options?.session instanceof ProtoService ? options?.session : undefined;
