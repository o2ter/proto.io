//
//  session.ts
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
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { ProtoService } from './index';
import { PVK, TUser } from '../../internals';
import { AUTH_COOKIE_KEY, MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../internals/common/const';
import { randomUUID } from '@o2ter/crypto-js';

const sessionMap = new WeakMap<Request, {
  sessionId: string;
  payload?: jwt.JwtPayload;
}>();

const _session = <E>(proto: ProtoService<E>) => {

  const req = proto.req;
  if (!req) return;

  sessionMap.set(req, { sessionId: randomUUID() });

  const jwtToken = proto[PVK].options.jwtToken;
  if (!proto.req || _.isNil(jwtToken)) return;

  if (_.isEmpty(jwtToken)) throw Error('Invalid jwt token');

  let authorization = '';
  if (proto.req.headers.authorization) {
    const parts = proto.req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') authorization = parts[1];
  } else if (proto.req.cookies[AUTH_COOKIE_KEY]) {
    authorization = proto.req.cookies[AUTH_COOKIE_KEY];
  }

  if (_.isEmpty(authorization)) return;

  try {

    const payload = jwt.verify(authorization, jwtToken, { ...proto[PVK].options.jwtVerifyOptions, complete: false });
    if (!_.isObject(payload)) return;

    sessionMap.set(req, {
      sessionId: payload.sessionId ?? randomUUID(),
      payload,
    });

    return payload;

  } catch {
    return;
  }
}

export const sessionId = <E>(proto: ProtoService<E>): string | undefined => {
  const req = proto.req;
  if (!req) return;
  const session = _session(proto);
  return sessionMap.get(req)?.sessionId ?? session?.sessionId;
}

type SessionInfo<E> = Partial<Awaited<ReturnType<typeof fetchSessionInfo<E>>>>;
const sessionInfoMap = new WeakMap<Request, SessionInfo<any>>();

const fetchSessionInfo = async <E>(proto: ProtoService<E>, userId?: string) => {
  const user = _.isString(userId) ? await proto.Query('User').get(userId, { master: true }) : undefined;
  const roles = user instanceof TUser ? _.compact(_.map(await proto.userRoles(user), x => x.name)) : [];
  return {
    roles: roles,
    user: user instanceof TUser ? user : undefined,
  };
}

export const session = async <E>(proto: ProtoService<E>) => {

  const req = proto.req;
  if (!req) return;

  const session = _session(proto);
  const sessionId: string | undefined = sessionMap.get(req)?.sessionId ?? session?.sessionId;

  const cached = sessionInfoMap.get(req) as SessionInfo<E>;
  if (cached) return { sessionId, ...cached };

  const info = await fetchSessionInfo(proto, session?.user);
  sessionInfoMap.set(req, info);

  return { sessionId, ...info };
}

export const sessionIsMaster = <E>(proto: ProtoService<E>) => {
  if (!proto.req) return false;
  const user = proto.req.header(MASTER_USER_HEADER_NAME);
  const pass = proto.req.header(MASTER_PASS_HEADER_NAME);
  if (_.isEmpty(user) || _.isEmpty(pass)) return false;
  return _.some(proto[PVK].options.masterUsers, x => x.user === user && x.pass === pass) ? 'valid' : 'invalid';
}

export const signUser = async <E>(proto: ProtoService<E>, res: Response, user?: TUser) => {
  const jwtToken = proto[PVK].options.jwtToken;
  if (_.isNil(jwtToken)) return;
  const sessionId = proto.sessionId ?? randomUUID();
  const token = jwt.sign({ sessionId, user: user?.objectId }, jwtToken, proto[PVK].options.jwtSignOptions);
  res.cookie(AUTH_COOKIE_KEY, token, proto[PVK].options.cookieOptions);
  sessionInfoMap.set(res.req, user ? await fetchSessionInfo(proto, user.objectId) : {});
}
