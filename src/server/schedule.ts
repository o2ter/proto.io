//
//  schedule.ts
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

import _ from 'lodash';
import { QuerySelector } from './query/dispatcher/parser';
import { ProtoService } from './proto';

const scheduleOp = {
  expireDocument: async (proto: ProtoService<any>) => {
    for (const className of proto.classes()) {
      if (className === 'File') {
        const found = proto.storage.find({
          className: 'File',
          filter: QuerySelector.decode({ _expired_at: { $lt: new Date() } }),
          matches: {},
          includes: ['_id', 'token'],
          objectIdSize: 0
        });
        for await (const item of found) {
          const token = item.get('token');
          if (!_.isEmpty(token)) proto.fileStorage.destory(proto, token);
        }
      }
      await proto.storage.deleteMany({
        className,
        filter: QuerySelector.decode({ _expired_at: { $lt: new Date() } }),
        includes: ['_id', '_expired_at'],
        matches: {},
        objectIdSize: 0
      });
    }
  }
}

export type ScheduleOp = keyof typeof scheduleOp;

export const schedule = (proto: ProtoService<any>) => {
  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    for (const [op, task] of _.entries(scheduleOp)) {
      if (!_.isFunction(task)) continue;
      try {
        await task(proto);
      } catch (e) {
        console.error(`Errors on schedule ${op}: ${e}`);
      }
    }
    running = false;
  }
  const schedule = setInterval(execute, 60 * 1000);
  return {
    execute,
    destory() { clearInterval(schedule); }
  }
}
