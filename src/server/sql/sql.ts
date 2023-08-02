//
//  sql.ts
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
import { TValue } from '../../internals';

type SQLLiteral = SQL | SQL[] | { literal: string | SQL[], separator?: string };
type SQLIdentifier = { identifier: string };
type SQLEscapeString = { quote: string };
type SQLValue = { value: TValue } | SQLIdentifier | SQLLiteral | SQLEscapeString;

export class SQL {

  strings: TemplateStringsArray;
  values: SQLValue[];

  constructor(templates: TemplateStringsArray, values: SQLValue[]) {
    this.strings = templates;
    this.values = values;
  }

  toString() {
    let idx = 1;
    let str = _.first(this.strings) ?? '';
    for (const part of this.strings.slice(1)) str += `$${idx++}${part}`;
    return str;
  }
}

export const sql = (templates: TemplateStringsArray, ...values: SQLValue[]) => new SQL(templates, values);
