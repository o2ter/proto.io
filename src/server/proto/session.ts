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
import { TRole } from '../../internals/object/role';

export type Session = jwt.JwtPayload & {
  sessionId: string;
  createdAt: Date;
  loginedAt: Date;
};

const sessionMap = new WeakMap<Request, Session>();

const _sessionWithToken = <E>(proto: ProtoService<E>, token: string) => {
  if (_.isEmpty(token)) return;
  const payload = proto[PVK].jwtVarify(token, 'login');
  if (!_.isObject(payload)) return;
  return {
    ...payload,
    sessionId: payload.sessionId ?? randomUUID(),
    createdAt: payload.createdAt && _.isSafeInteger(payload.createdAt) ? new Date(payload.createdAt) : new Date,
    loginedAt: payload.loginedAt && _.isSafeInteger(payload.loginedAt) ? new Date(payload.loginedAt) : new Date,
  } as Session;
}

const _session = <E>(proto: ProtoService<E>, request: Request) => {

  const cached = sessionMap.get(request);
  if (cached) return cached;

  sessionMap.set(request, {
    sessionId: randomUUID(),
    createdAt: new Date,
    loginedAt: new Date,
  });

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

  const session = _sessionWithToken(proto, authorization);
  if (!_.isObject(session)) return;

  sessionMap.set(request, session);
  return session;
}

export const sessionId = <E>(proto: ProtoService<E>, request: Request): string | undefined => {
  const session = _session(proto, request);
  return sessionMap.get(request)?.sessionId ?? session?.sessionId;
}

const userCacheMap = new WeakMap<any, {
  [K in string]?: Promise<{ user?: TUser; _roles?: TRole[] }>;
}>;

const fetchSessionInfo = async <E>(proto: ProtoService<E>, userId?: string) => {
  if (!userId) return {};
  if (!userCacheMap.has(proto[PVK])) userCacheMap.set(proto[PVK], {});
  const cache = userCacheMap.get(proto[PVK])!;
  if (_.isNil(cache[userId])) cache[userId] = (async () => {
    const user = _.isString(userId) ? await proto.Query('User').get(userId, { master: true }) : undefined;
    const _roles = user instanceof TUser ? _.filter(await proto.userRoles(user), x => !_.isEmpty(x.name)) : [];
    cache[userId] = undefined;
    return { user, _roles };
  })();
  const { user, _roles } = await cache[userId];
  return {
    user: user?.clone(),
    _roles: _.map(_roles, x => x.clone()),
  };
}

export const sessionWithToken = async <E>(proto: ProtoService<E>, token: string) => {
  const session = _sessionWithToken(proto, token);
  const info = await fetchSessionInfo(proto, session?.user);
  return {
    ...session ?? {},
    ...info,
    loginedAt: info?.user ? session?.loginedAt : undefined,
  };
}

type SessionInfo<E> = Partial<Awaited<ReturnType<typeof fetchSessionInfo<E>>>>;
const sessionInfoMap = new WeakMap<Request, SessionInfo<any>>();

export const session = async <E>(proto: ProtoService<E>, request: Request) => {

  const session = _session(proto, request);
  const cached = sessionInfoMap.get(request) as SessionInfo<E>;
  if (cached) return {
    ...session ?? {},
    ...cached,
    loginedAt: cached?.user ? session?.loginedAt : undefined,
  };

  const info = await fetchSessionInfo(proto, session?.user);
  sessionInfoMap.set(request, info);

  return {
    ...session ?? {},
    ...info,
    loginedAt: info?.user ? session?.loginedAt : undefined,
  };
}

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
  const cookieOptions = options?.cookieOptions ?? session?.cookieOptions ?? proto[PVK].options.cookieOptions;
  const token = proto[PVK].jwtSign({
    sessionId: session?.sessionId ?? randomUUID(),
    createdAt: session?.createdAt?.getTime() ?? Date.now(),
    loginedAt: user ? session?.loginedAt?.getTime() ?? Date.now() : undefined,
    user: user?.objectId,
    cookieOptions,
  }, options?.jwtSignOptions ?? 'login');
  res.cookie(AUTH_COOKIE_KEY, token, cookieOptions);
  sessionInfoMap.set(res.req, user ? await fetchSessionInfo(proto, user.objectId) : {});
}
