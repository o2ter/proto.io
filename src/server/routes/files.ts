//
//  files.ts
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
import { Router } from 'express';
import { Proto } from '../../server';
import busboy from 'busboy';

export default <E>(router: Router, payload: Proto<E>) => {

  router.post(
    '/files',
    (req, res) => {
      const formData = busboy(req);

      formData.on('field', (name, val) => {
        console.log(name, val)
      });

      formData.on('file', (name, file, { filename, mimeType }) => {
        console.log(name, filename, mimeType)
        file.on('data', (data) => {
          console.log(`File [${name}] got ${data.length} bytes`);
        }).on('close', () => {
          console.log(`File [${name}] done`);
        });
      });

      formData.on('close', () => {
        res.json({});
      });

      req.pipe(formData);
    }
  );

  return router;
}