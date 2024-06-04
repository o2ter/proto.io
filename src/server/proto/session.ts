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
import { CookieOptions, Request, Response } from '@o2ter/server-js';
import { ProtoService } from './index';
import { AUTH_COOKIE_KEY, MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../internals/const';
import { randomUUID } from '@o2ter/crypto-js';
import { PVK } from '../../internals/private';
import { TUser } from '../../internals/object/user';

const sessionMap = new WeakMap<Request, {
  sessionId: string;
  payload?: jwt.JwtPayload;
}>();

const _sessionWithToken = <E>(proto: ProtoService<E>, token: string) => {
  if (_.isEmpty(token)) return;
  const payload = proto[PVK].jwtVarify('login', token);
  if (!_.isObject(payload)) return;
  return payload;
}

const _session = <E>(proto: ProtoService<E>, request: Request) => {

  const cached = sessionMap.get(request);
  if (cached) return cached?.payload;

  sessionMap.set(request, { sessionId: randomUUID() });

  const jwtToken = proto[PVK].options.jwtToken;
  if (_.isEmpty(jwtToken)) throw Error('Invalid jwt token');

  let authorization = '';
  if (request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') authorization = parts[1];
  } else if (request.cookies[AUTH_COOKIE_KEY]) {
    authorization = request.cookies[AUTH_COOKIE_KEY];
  }

  if (_.isEmpty(authorization)) return;

  const payload = proto[PVK].jwtVarify('login', authorization);
  if (!_.isObject(payload)) return;

  sessionMap.set(request, {
    sessionId: payload.sessionId ?? randomUUID(),
    payload,
  });

  return payload;
}

export const sessionId = <E>(proto: ProtoService<E>, request: Request): string | undefined => {
  const session = _session(proto, request);
  return sessionMap.get(request)?.sessionId ?? session?.sessionId;
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

export const sessionWithToken = async <E>(proto: ProtoService<E>, token: string) => {
  const session = _sessionWithToken(proto, token);
  const sessionId: string | undefined = session?.sessionId;
  const info = await fetchSessionInfo(proto, session?.user);
  return { sessionId, ...info };
}

export const session = async <E>(proto: ProtoService<E>, request: Request) => {

  const session = _session(proto, request);
  const sessionId: string | undefined = sessionMap.get(request)?.sessionId ?? session?.sessionId;

  const cached = sessionInfoMap.get(request) as SessionInfo<E>;
  if (cached) return { sessionId, ...cached };

  const info = await fetchSessionInfo(proto, session?.user);
  sessionInfoMap.set(request, info);

  return { sessionId, ...info };
}

export type Session = Awaited<ReturnType<typeof session>>;

export const sessionIsMaster = <E>(proto: ProtoService<E>, request: Request) => {
  const user = request.header(MASTER_USER_HEADER_NAME);
  const pass = request.header(MASTER_PASS_HEADER_NAME);
  if (_.isEmpty(user) || _.isEmpty(pass)) return false;
  return _.some(proto[PVK].options.masterUsers, x => x.user === user && x.pass === pass) ? 'valid' : 'invalid';
}

export const signUser = async <E>(
  proto: ProtoService<E>,
  res: Response,
  user?: TUser,
  options?: {
    cookieOptions?: CookieOptions;
    jwtSignOptions?: jwt.SignOptions;
  }
) => {
  if (_.isNil(proto[PVK].options.jwtToken)) return;
  const session = _session(proto, res.req);
  const sessionId = sessionMap.get(res.req)?.sessionId ?? session?.sessionId ?? randomUUID();
  const cookieOptions = options?.cookieOptions ?? session?.cookieOptions ?? proto[PVK].options.cookieOptions;
  const token = proto[PVK].jwtSign('login', { sessionId, user: user?.objectId, cookieOptions }, options?.jwtSignOptions);
  res.cookie(AUTH_COOKIE_KEY, token, cookieOptions);
  sessionInfoMap.set(res.req, user ? await fetchSessionInfo(proto, user.objectId) : {});
}
