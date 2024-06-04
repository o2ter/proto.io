//
//  update.ts
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
import { SQL, sql } from '../../../../server/storage/sql/sql';
import { TSchema } from '../../../../internals/schema';
import { _encodeJsonValue } from './encode';
import { stringArrayAttrs } from './basic';
import { encodeType } from './encode';
import { nullSafeEqual } from './basic';
import Decimal from 'decimal.js';
import { TObject, decodeUpdateOp } from '../../../../internals/object';
import { TUpdateOp } from '../../../../internals/object/types';
import { _encodeValue } from '../../../../internals/query/value';

export const updateOperation = (paths: string[], dataType: TSchema.DataType, operation: TUpdateOp) => {
  const [column, ...subpath] = paths;
  const [op, value] = decodeUpdateOp(operation);
  if (_.isEmpty(subpath)) {
    switch (op) {
      case '$set': return sql`${encodeType(column, dataType, value)}`;
      case '$inc': return sql`${{ identifier: column }} + ${encodeType(column, dataType, value)}`;
      case '$dec': return sql`${{ identifier: column }} - ${encodeType(column, dataType, value)}`;
      case '$mul': return sql`${{ identifier: column }} * ${encodeType(column, dataType, value)}`;
      case '$div': return sql`${{ identifier: column }} / ${encodeType(column, dataType, value)}`;
      case '$max': return sql`GREATEST(${{ identifier: column }}, ${encodeType(column, dataType, value)})`;
      case '$min': return sql`LEAST(${{ identifier: column }}, ${encodeType(column, dataType, value)})`;
      default: break;
    }
    if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
      switch (op) {
        case '$popFirst':
          if (!_.isNumber(value) || !_.isSafeInteger(value) || value < 0) break;
          return sql`${{ identifier: column }}[${{ literal: `${value + 1}` }}:]`;
        case '$popLast':
          if (!_.isNumber(value) || !_.isSafeInteger(value) || value < 0) break;
          return sql`${{ identifier: column }}[:array_length(${{ identifier: column }}, 1) - ${{ literal: `${value}` }}]`;
        default:
          {
            const isStringArray = _.includes(stringArrayAttrs, column);
            if (!_.isArray(value)) break;
            if (isStringArray && !_.every(value, x => _.isString(x))) break;
            switch (op) {
              case '$addToSet':
                if (!_.isArray(value)) break;
                return sql`${{ identifier: column }} || ARRAY(
                  SELECT *
                  FROM UNNEST(ARRAY[${_.map(_.uniq(value), x => isStringArray ? sql`${{ value: x }}` : _encodeJsonValue(_encodeValue(x)))}]) "$"
                  WHERE "$" != ALL(${{ identifier: column }})
                )`;
              case '$push':
                if (!_.isArray(value)) break;
                return sql`${{ identifier: column }} || ARRAY[${_.map(value, (x: any) => isStringArray ? sql`${{ value: x }}` : sql`${_encodeJsonValue(_encodeValue(x))}`)}]`;
              case '$removeAll':
                if (!_.isArray(value)) break;
                return sql`ARRAY(
                  SELECT *
                  FROM UNNEST(${{ identifier: column }}) "$"
                  WHERE "$" NOT IN (${_.map(_.uniq(value), x => isStringArray ? sql`${{ value: x }}` : _encodeJsonValue(_encodeValue(x)))})
                )`;
              default: break;
            }
          }
      }
    } else if (!_.isString(dataType) && dataType?.type === 'relation' && _.isNil(dataType.foreignField)) {
      switch (op) {
        case '$addToSet':
        case '$push':
          {
            if (!_.isArray(value) || !_.every(value, x => x instanceof TObject && x.objectId)) break;
            const objectIds = _.uniq(_.map(value, (x: any) => `${x.className}$${x.objectId}`));
            return sql`ARRAY(
              SELECT DISTINCT "$"
              FROM UNNEST(${{ identifier: column }} || ARRAY[${_.map(objectIds, (x) => sql`${{ value: x }}`)}]) "$"
              RIGHT JOIN ${{ identifier: dataType.target }} ON "$" = (${{ quote: dataType.target + '$' }} || ${{ identifier: dataType.target }}._id)
            )`;
          }
        case '$removeAll':
          {
            if (!_.isArray(value) || !_.every(value, x => x instanceof TObject && x.objectId)) break;
            const objectIds = _.uniq(_.map(value, (x: any) => `${x.className}$${x.objectId}`));
            return sql`ARRAY(
              SELECT "$"
              FROM UNNEST(${{ identifier: column }}) "$"
              RIGHT JOIN ${{ identifier: dataType.target }} ON "$" = (${{ quote: dataType.target + '$' }} || ${{ identifier: dataType.target }}._id)
              WHERE "$" NOT IN (${_.map(objectIds, (x) => sql`${{ value: x }}`)})
            )`;
          }
        default: break;
      }
    }
  } else {
    let element = sql`${{ identifier: column }}`;
    const _subpath = sql`${_.map(subpath, x => sql`${{ quote: x.startsWith('$') ? `$${x}` : x }}`)}`;
    let updateKey: (value: SQL) => SQL;
    if (dataType === 'array' || (!_.isString(dataType) && dataType?.type === 'array')) {
      element = sql`jsonb_extract_path(to_jsonb(${element}), ${_subpath})`;
      updateKey = (value: SQL) => sql`ARRAY(SELECT * FROM jsonb_array_elements(
        jsonb_set(to_jsonb(${{ identifier: column }}), ARRAY[${_subpath}], ${value})
      ))`;
    } else {
      element = sql`jsonb_extract_path(${element}, ${_subpath})`;
      updateKey = (value: SQL) => sql`jsonb_set(${{ identifier: column }}, ARRAY[${_subpath}], ${value})`;
    }
    switch (op) {
      case '$set': return updateKey(_encodeJsonValue(_encodeValue(value)));
      case '$inc':
      case '$dec':
      case '$mul':
      case '$div':
        {
          const operatorMap = {
            $inc: '+',
            $dec: '-',
            $mul: '*',
            $div: '/',
          };
          return updateKey(sql`
            CASE
            WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'number'
              THEN to_jsonb(${element}::NUMERIC ${{ literal: operatorMap[op] }}
                ${{ value: value instanceof Decimal ? value.toNumber() : value }})
            WHEN jsonb_typeof(${element} -> '$decimal') ${nullSafeEqual()} 'string'
              THEN jsonb_build_object(
                '$decimal', CAST(
                  ((${element} ->> '$decimal')::DECIMAL ${{ literal: operatorMap[op] }}
                    ${{ value: value instanceof Decimal ? value.toString() : value }}::DECIMAL)
                AS TEXT)
              )
            ELSE NULL
            END
          `);
        }
      case '$max':
      case '$min':
        {
          const operatorMap = {
            $max: 'GREATEST',
            $min: 'LEAST',
          };
          if (value instanceof Decimal || _.isNumber(value)) {
            return updateKey(sql`
              CASE
              WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'number'
                THEN to_jsonb(${{ literal: operatorMap[op] }}(
                  ${element}::NUMERIC,
                  ${{ value: value instanceof Decimal ? value.toNumber() : value }}
                ))
              WHEN jsonb_typeof(${element} -> '$decimal') ${nullSafeEqual()} 'string'
                THEN jsonb_build_object(
                  '$decimal', CAST(${{ literal: operatorMap[op] }}(
                    (${element} ->> '$decimal')::DECIMAL,
                    ${{ value: value instanceof Decimal ? value.toString() : value }}::DECIMAL
                  ) AS TEXT))
              ELSE NULL
              END
            `);
          } else if (_.isDate(value)) {
            return updateKey(sql`
              CASE
              WHEN jsonb_typeof(${element} -> '$date') ${nullSafeEqual()} 'string'
                THEN jsonb_build_object(
                  '$date', ${{ literal: operatorMap[op] }}(${element} ->> '$date', ${{ value: value.toISOString() }})
                )
              ELSE NULL
              END
            `);
          } else {
            return sql`${{ literal: operatorMap[op] }}(${element}, ${_encodeJsonValue(_encodeValue(value))})`;
          }
        }
      case '$addToSet':
        if (!_.isArray(value)) break;
        return updateKey(sql`
          CASE
          WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'array'
            THEN ${element} || to_jsonb(ARRAY(
              SELECT *
              FROM UNNEST(ARRAY[${_.map(_.uniq(value), x => _encodeJsonValue(_encodeValue(x)))}]) "$"
              WHERE NOT to_jsonb(ARRAY["$"]) <@ ${element}
            ))
          ELSE NULL
          END
        `);
      case '$push':
        if (!_.isArray(value)) break;
        return updateKey(sql`
          CASE
          WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'array'
            THEN ${element} || ${_encodeJsonValue(_encodeValue(value))}
          ELSE NULL
          END
        `);
      case '$removeAll':
        if (!_.isArray(value)) break;
        return updateKey(sql`
          CASE
          WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'array'
            THEN to_jsonb(ARRAY(
              SELECT *
              FROM jsonb_array_elements(${element}) "$"
              WHERE value NOT IN (${_.map(_.uniq(value), x => _encodeJsonValue(_encodeValue(x)))})
            ))
          ELSE NULL
          END
        `);
      case '$popFirst':
        if (!_.isNumber(value) || !_.isSafeInteger(value) || value < 0) break;
        return updateKey(sql`
          CASE
          WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'array'
            THEN to_jsonb((ARRAY(
              SELECT jsonb_array_elements(${element})
            ))[${{ literal: `${value + 1}` }}:])
          ELSE NULL
          END
        `);
      case '$popLast':
        if (!_.isNumber(value) || !_.isSafeInteger(value) || value < 0) break;
        return updateKey(sql`
          CASE
          WHEN jsonb_typeof(${element}) ${nullSafeEqual()} 'array'
            THEN to_jsonb((ARRAY(
              SELECT jsonb_array_elements(${element})
            ))[:jsonb_array_length(${element}) - ${{ literal: `${value}` }}])
          ELSE NULL
          END
        `);
      default: break;
    }
  }
  throw Error('Invalid update operation');
};
