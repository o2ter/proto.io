//
//  index.ts
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

import { TExtensions, TFile, TObject, TQuery, TRole, TUser } from '../internals/index';

export * from './codec';
export const classExtends = <E>(x: TExtensions<E>) => x;

export const isQuery = (x: any): x is TQuery<any, any, any, any> => {
  return x instanceof TQuery;
}

export const isObject = (x: any): x is TObject => {
  return x instanceof TObject;
}

export const isUser = (x: any): x is TUser => {
  return x instanceof TUser;
}

export const isRole = (x: any): x is TRole => {
  return x instanceof TRole;
}

export const isFile = (x: any): x is TFile => {
  return x instanceof TFile;
}
