//
//  session.ts
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
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { ProtoService } from './index';
import { PVK, TUser } from '../../internals';
import { AUTH_COOKIE_KEY, MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../internals/common/const';

const sessionMap = new WeakMap<Request, {
  sessionId: string;
  payload?: jwt.JwtPayload;
}>();

const sessionUserMap = new WeakMap<Request, {
  user?: TUser;
  roles: string[];
}>();

const _session = <E>(proto: ProtoService<E>) => {

  const req = proto.req;
  if (!req) return;

  sessionMap.set(req, { sessionId: crypto.randomUUID() });

  const jwtToken = proto[PVK].options.jwtToken;
  if (!proto.req || _.isNil(jwtToken)) return;

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
    if (!_.isObject(payload)) return { invalid: true };

    sessionMap.set(req, {
      sessionId: payload.sessionId ?? crypto.randomUUID(),
      payload,
    });

    return payload;

  } catch {
    return { invalid: true };
  }
}

export const sessionId = <E>(proto: ProtoService<E>): string | undefined => {
  const req = proto.req;
  if (!req) return;
  const session = _session(proto);
  return sessionMap.get(req)?.sessionId ?? session?.sessionId;
}

export const isInvalidSession = <E>(proto: ProtoService<E>): boolean => {
  const req = proto.req;
  if (!req) return false;
  const session = _session(proto);
  return session?.invalid ?? false;
}

export const session = async <E>(proto: ProtoService<E>) => {

  const req = proto.req;
  if (!req) return;

  const session = _session(proto);
  const sessionId: string | undefined = sessionMap.get(req)?.sessionId ?? session?.sessionId;

  const cached = sessionUserMap.get(req);
  if (cached) return { sessionId, ...cached };

  const user = session?.user && _.isString(session.user) ? await proto.Query('User', { master: true }).get(session.user) : undefined;
  const roles = user instanceof TUser ? _.compact(_.map(await proto.userRoles(user), x => x.name)) : [];

  const result = {
    sessionId,
    roles: roles,
    user: user instanceof TUser ? user : undefined,
  };

  sessionUserMap.set(req, result);
  return result;
}

export const sessionIsMaster = <E>(proto: ProtoService<E>) => {
  if (!proto.req) return false;
  const user = proto.req.header(MASTER_USER_HEADER_NAME);
  const pass = proto.req.header(MASTER_PASS_HEADER_NAME);
  if (_.isEmpty(user) || _.isEmpty(pass)) return false;
  return _.some(proto[PVK].options.masterUsers, x => x.user === user && x.pass === pass) ? 'valid' : 'invalid';
}
