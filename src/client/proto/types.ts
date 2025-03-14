//
//  types.ts
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

import { TExtensions } from '../../internals/object/types';

/**
 * Options for configuring Axios requests.
 */
export type AxiosOptions = {
  /**
   * The name of the XSRF cookie.
   */
  xsrfCookieName?: string;

  /**
   * The name of the XSRF header.
   */
  xsrfHeaderName?: string;

  /**
   * The limit for retry attempts.
   */
  retryLimit?: number;

  /**
   * The key for storing cookies.
   */
  cookieKey?: string;
};

/**
 * Options for configuring the Proto client.
 */
export type ProtoOptions<Ext> = {
  /**
   * The endpoint URL for the Proto client.
   */
  endpoint: string;

  /**
   * The socket endpoint URL for the Proto client.
   */
  socketEndpoint?: string;

  /**
   * The master user credentials.
   */
  masterUser?: { user: string; pass: string; };

  /**
   * The class extensions.
   */
  classExtends?: TExtensions<Ext>;

  /**
   * The Axios configuration options.
   */
  axiosOptions?: AxiosOptions;
};
