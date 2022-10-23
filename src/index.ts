//
//  index.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2022 O2ter Limited. All rights reserved.
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
import express from 'express';
import cookieParser from 'cookie-parser';
import { IOSerializable, serialize_json, deserialize_json } from './codec';
import tokenHandler from './router/token';

export * from './codec';

type Options = {
  token?: string;
  functions?: Record<string, (request: Payload & {
    data: IOSerializable;
  }) => IOSerializable | Promise<IOSerializable>>;
};

class Payload {

  options: Options;

  constructor(options: Options) {
    this.options = options
  }

  async run(name: string, data?: IOSerializable) {
    const func = this.options.functions?.[name];
    const payload = Object.setPrototypeOf({
      data: data ?? null,
    }, this);
    return _.isFunction(func) ? func(payload) : null;
  }
}

export default (options: Options) => {

  const { token, functions } = options;

  const router = express.Router()
    .use(cookieParser() as any)
    .use(tokenHandler(token));

  const payload = new Payload(options);

  if (!_.isNil(functions)) {

    router.post(
      '/functions/:name',
      express.text({ type: '*/*' }),
      async (req, res) => {

        const { name } = req.params;
        const func = functions[name];

        if (!_.isFunction(func)) {
          res.sendStatus(404);
          return;
        }

        try {

          const data = deserialize_json(req.body);
          const _payload = Object.setPrototypeOf({
            ..._.omit(req, 'body'),
            data: data ?? null,
          }, payload);
          const result = await func(_payload);

          res.json(serialize_json(result));

        } catch (error) {

          if (error instanceof String) {
            res.status(400).json({ message: error });
          } else if (error instanceof Error) {
            res.status(400).json({ message: error.message });
          } else {
            res.status(400).json(error);
          }
        }
      }
    );
  }

  return router;
}