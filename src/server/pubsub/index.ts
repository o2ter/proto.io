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

import { Awaitable } from '@o2ter/utils-js';
import { TValueWithoutObject } from '../../internals/types';

/**
 * Interface for publish-subscribe operations.
 */
export interface TPubSub {

  /**
   * Subscribes to a channel.
   * @param channel - The name of the channel to subscribe to.
   * @param callback - The callback function to handle the event data.
   * @returns A function to unsubscribe from the channel.
   */
  subscribe(channel: string, callback: (payload: TValueWithoutObject) => void): VoidFunction;

  /**
   * Publishes an event to a channel.
   * @param channel - The name of the channel to publish to.
   * @param payload - The event data to publish.
   * @returns A promise that resolves when the event is published.
   */
  publish(channel: string, payload: TValueWithoutObject): Awaitable<void>;
}
