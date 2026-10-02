//
//  function.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
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
import { Server, Router } from '@o2ter/server-js';
import { ProtoService } from '../proto';
import { encodeError } from './common';
import { deserialize, serialize } from '../../internals/codec';
import { PVK } from '../../internals/private';
import { TObject } from '../../internals/object';
import {
  CHALLENGE_CLIENT_TYPE_HEADER_NAME,
  CHALLENGE_RESPONSE_HEADER_NAME,
} from '../../internals/const';

const challengeEnabled = (challenge: any) => (
  challenge === true || (_.isPlainObject(challenge) && challenge.enabled !== false)
);

const challengeClientTypes = (challenge: any) => (
  _.isPlainObject(challenge) && _.isArray(challenge.clientTypes) ? challenge.clientTypes : undefined
);

const parseChallenge = (value?: string) => {
  if (!value) return undefined;
  return deserialize(decodeURIComponent(value));
};

export default <E>(router: Router, proto: ProtoService<E>) => {

  router.post(
    '/functions/:name',
    Server.text({ type: '*/*' }),
    async (req, res) => {

      res.setHeader('Cache-Control', ['no-cache', 'no-store']);

      const { name } = req.params;
      const func = proto[PVK].functions[name];
      if (_.isNil(func)) return void res.sendStatus(404);

      try {

        const abortController = new AbortController();
        res.on('close', () => abortController.abort());

        const params = deserialize(req.body, { objAttrs: TObject.defaultReadonlyKeys });
        const payload = proto.connect(req, x => ({
          params: x.rebind(params),
          abortSignal: abortController.signal,
        }));
        const startedAt = Date.now();
        const recordUserActivity = (status: 'success' | 'error', error?: unknown) => {
          const callback = proto[PVK].options.userActivityCallback;
          if (!callback) return;
          try {
            void Promise.resolve(callback({
              proto: payload,
              functionName: name,
              params: payload.params,
              isMaster: payload.isMaster,
              status,
              durationMs: Date.now() - startedAt,
              error,
              req,
            })).catch(activityError => {
              payload.logger.error(activityError);
            });
          } catch (activityError) {
            payload.logger.error(activityError);
          }
        };
        const validator = _.isFunction(func) ? undefined : func.validator;
        const challenge = validator?.challenge;

        if (
          challengeEnabled(challenge)
          && !payload.isMaster
        ) {
          const challengeProvider = proto[PVK].options.challengeProvider;
          if (!challengeProvider) throw new Error('Challenge provider is not configured');

          const clientType = _.trim(req.header(CHALLENGE_CLIENT_TYPE_HEADER_NAME) || '') || undefined;
          const clientTypes = challengeClientTypes(challenge);
          if (
            clientTypes
            && !_.includes(clientTypes, clientType)
          ) {
            throw new Error('Invalid challenge client type');
          }

          const challengeValue = parseChallenge(req.header(CHALLENGE_RESPONSE_HEADER_NAME));
          if (_.isNil(challengeValue)) {
            return void res.status(428).json({
              message: 'Challenge required',
              code: 'challenge_required',
            });
          }

          const verified = await challengeProvider.verify({
            proto: payload,
            functionName: name,
            params: payload.params,
            clientType,
            challenge: challengeValue,
            req,
          });
          if (verified === false) throw new Error('Challenge verification failed');
        }

        const data = await (async () => {
          try {
            return await payload[PVK].run(payload, name, { master: payload.isMaster });
          } catch (error) {
            recordUserActivity('error', error);
            throw error;
          }
        })();

        res.type('application/json');

        if (_.isObjectLike(data) && Symbol.asyncIterator in data) {
          let first = true;
          try {
            for await (const item of data) {
              res.write(`${first ? '[' : ','}${serialize(item ?? null)}\n`);
              if (_.isFunction(res.flush)) res.flush();
              first = false;
            }
            recordUserActivity('success');
            res.write(first ? '[]' : ']');
            res.end();
          } catch (error) {
            recordUserActivity('error', error);
            if (first) {
              res.status(400).json(encodeError(error));
            } else {
              res.write(JSON.stringify(encodeError(error)));
              res.end();
            }
          }
        } else {
          recordUserActivity('success');
          res.send(serialize(data ?? null));
        }
      } catch (error) {
        res.status(400).json(encodeError(error));
      }
    }
  );

  return router;
}
