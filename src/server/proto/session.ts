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
import jwt from 'jsonwebtoken';
import { ProtoService } from './index';
import { PVK, TUser, UUID } from '../../internals';
import { AUTH_COOKIE_KEY, MASTER_PASS_HEADER_NAME, MASTER_USER_HEADER_NAME } from '../../common/const';

const _session = <E>(proto: ProtoService<E>) => {

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

  const payload = jwt.verify(authorization, jwtToken, { ...proto[PVK].options.jwtVerifyOptions, complete: false });
  if (!_.isObject(payload)) return;

  const req = proto.req as any;
  req.sessionId = payload.sessionId ?? (new UUID).toHexString();

  return payload;
}

export const sessionId = <E>(proto: ProtoService<E>): string | undefined => {
  if (!proto.req) return;
  const req = proto.req as any;
  const session = _session(proto);
  return req.sessionId ?? session?.sessionId;
}

export const session = async <E>(proto: ProtoService<E>) => {
  if (!proto.req) return;

  const req = proto.req as any;
  const session = _session(proto);
  const user = session?.user && _.isString(session.user) ? await proto.Query('User', { master: true }).get(session.user) : undefined;
  const roles = user instanceof TUser ? _.map(await proto.userRoles(user), x => x.name) : [];
  const sessionId: string | undefined = req.sessionId ?? session?.sessionId;

  req.sessionId = sessionId;
  req.roles = roles;
  req.user = user instanceof TUser ? user : undefined;

  return {
    sessionId,
    roles: roles,
    user: user instanceof TUser ? user : undefined,
  };
}

export const sessionIsMaster = <E>(proto: ProtoService<E>) => {
  if (!proto.req) return false;
  const user = proto.req.header(MASTER_USER_HEADER_NAME);
  const pass = proto.req.header(MASTER_PASS_HEADER_NAME);
  if (_.isEmpty(user) || _.isEmpty(pass)) return false;
  return _.some(proto[PVK].options.masterUsers, x => x.user === user && x.pass === pass);
}