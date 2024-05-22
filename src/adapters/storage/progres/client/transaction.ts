//
//  transaction.ts
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

import { sql } from '../../../../server/storage/sql';
import { PostgresClientDriver } from '../driver';
import { PostgresStorageClient } from './base';

export class PostgresStorageTransaction extends PostgresStorageClient<PostgresClientDriver> {

  counter: number;
  private _selectLock: boolean;

  constructor(driver: PostgresClientDriver, counter: number, selectLock: boolean) {
    super(driver);
    this.counter = counter;
    this._selectLock = selectLock;
  }

  selectLock() {
    return this._selectLock;
  }

  override async withTransaction<T>(
    callback: (connection: PostgresStorageTransaction) => PromiseLike<T>
  ) {

    const transaction = new PostgresStorageTransaction(this._driver, this.counter + 1, this._selectLock);
    transaction.schema = this.schema;

    try {

      await transaction.query(sql`SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);
      const result = await callback(transaction);
      await transaction.query(sql`RELEASE SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);

      return result;

    } catch (e) {
      await transaction.query(sql`ROLLBACK TO SAVEPOINT ${{ identifier: `savepoint_${this.counter}` }}`);
      throw e;
    }
  }
}
