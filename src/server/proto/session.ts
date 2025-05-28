//
//  session.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { AUTH_COOKIE_KEY, AUTH_ALT_COOKIE_KEY, MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../internals/const';
import { randomUUID } from '@o2ter/crypto-js';
import { PVK } from '../../internals/private';
import { TUser } from '../../internals/object/user';
import { TRole } from '../../internals/object/role';
import { TSession } from '../../internals/object/session';

export type _Session = Awaited<ReturnType<typeof session>>;

const _sessionWithToken = async <E>(proto: ProtoService<E>, token: string) => {
  if (_.isEmpty(token)) return;
  const { payload = {} } = proto[PVK].jwtVarify(token, 'login') ?? {};
  if (!_.isString(payload.sessionId) || _.isEmpty(payload.sessionId)) return;
  return {
    payload,
    session: await proto.Query('Session')
      .equalTo('token', payload.sessionId)
      .includes('user')
      .first({ master: true }),
  };
}

const userCacheMap = new WeakMap<any, { [K in string]?: Promise<TRole[]>; }>();
const fetchUserRole = async <E>(proto: ProtoService<E>, user?: TUser) => {
  if (!userCacheMap.has(proto[PVK])) userCacheMap.set(proto[PVK], {});
  const cache = userCacheMap.get(proto[PVK])!;
  if (_.isNil(user?.id)) return {};
  if (_.isNil(cache[user.id])) cache[user.id] = (async () => {
    const _roles = user instanceof TUser ? _.filter(await proto.userRoles(user), x => !_.isEmpty(x.name)) : [];
    cache[user.id!] = undefined;
    return _roles;
  })();
  const _roles = await cache[user.id];
  return {
    user: user?.clone(),
    _roles: _.map(_roles, x => x.clone()),
  };
}

const sessionMap = new WeakMap<Request, { payload: any, session: TSession } | undefined>();
const _session = async <E>(proto: ProtoService<E>, request: Request) => {

  const cached = sessionMap.get(request);
  if (cached) return {
    sessionId: cached.session.sessionId,
    createdAt: cached.session.createdAt!,
    updatedAt: cached.session.updatedAt!,
    loginedAt: cached.session.loginedAt,
    user: cached.session.user,
    cookieOptions: cached.payload.cookieOptions,
  };

  const cookieKey = _.last(_.castArray(request.headers[AUTH_ALT_COOKIE_KEY] || [])) || AUTH_COOKIE_KEY;

  let sessionId = '';
  if (request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') sessionId = parts[1];
  } else if (request.cookies[cookieKey]) {
    sessionId = request.cookies[cookieKey];
  }

  if (_.isEmpty(sessionId)) return;

  const { payload, session } = await _sessionWithToken(proto, sessionId) ?? {};
  if (!session) return;

  sessionMap.set(request, { payload, session });
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt!,
    updatedAt: session.updatedAt!,
    loginedAt: session.loginedAt,
    user: session.user,
    cookieOptions: payload.cookieOptions,
  };
}

type UserRole<E> = Partial<Awaited<ReturnType<typeof fetchUserRole<E>>>>;
const userRoleMap = new WeakMap<Request, UserRole<any>>();

export const session = async <E>(proto: ProtoService<E>, request: Request) => {

  const session = await _session(proto, request);
  const cached = userRoleMap.get(request) as UserRole<E>;
  if (cached) return {
    ...session ?? {},
    ...cached,
  };

  const info = await fetchUserRole(proto, session?.user);
  userRoleMap.set(request, info);

  return {
    ...session ?? {},
    ...info,
  };
}

export const sessionWithToken = async <E>(proto: ProtoService<E>, token: string) => {

  const { payload, session } = await _sessionWithToken(proto, token) ?? {};
  if (!session) return;

  const info = await fetchUserRole(proto, session?.user);
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt!,
    updatedAt: session.updatedAt!,
    loginedAt: session.loginedAt,
    cookieOptions: payload.cookieOptions,
    ...info,
  } as _Session;
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
  const session = await _session(proto, res.req);
  const cookieOptions = options?.cookieOptions ?? session?.cookieOptions ?? proto[PVK].options.cookieOptions;
  const sessionId = session?.sessionId ?? randomUUID();
  const expiredAt = cookieOptions?.expires ?? (cookieOptions?.maxAge ? new Date(Date.now() + cookieOptions.maxAge) : undefined);
  const loginedAt = user ? session?.loginedAt ?? new Date() : undefined;
  await proto.Query('Session')
    .equalTo('token', sessionId)
    .upsertOne(
      {
        loginedAt: { $set: loginedAt },
        user: { $set: user },
        _expired_at: { $set: expiredAt },
      },
      {
        token: sessionId,
        loginedAt: loginedAt,
        user,
        _expired_at: expiredAt,
      },
      { master: true }
    );
  const token = proto[PVK].jwtSign({
    sessionId,
    cookieOptions,
  }, options?.jwtSignOptions ?? 'login');
  const cookieKey = _.last(_.castArray(res.req.headers[AUTH_ALT_COOKIE_KEY] || [])) || AUTH_COOKIE_KEY;
  res.cookie(cookieKey, token, cookieOptions);
  userRoleMap.set(res.req, user ? await fetchUserRole(proto, user) : {});
}
