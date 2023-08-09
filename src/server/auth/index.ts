//
//  index.ts
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
import { Proto } from '../proto/index';
import { PVK, TUser, UUID } from '../../internals';
import { RequestHandler } from 'express';
import {
  AUTH_COOKIE_KEY,
  MASTER_USER_HEADER_NAME,
  MASTER_PASS_HEADER_NAME,
} from '../../common/const';
import { signUser } from './sign';

export default <E>(proto: Proto<E>): RequestHandler => async (req: any, res, next) => {

  const jwtToken = proto[PVK].options.jwtToken;
  if (_.isNil(jwtToken)) return next();

  let authorization = '';
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') authorization = parts[1];
  } else if (req.cookies[AUTH_COOKIE_KEY]) {
    authorization = req.cookies[AUTH_COOKIE_KEY];
  }

  if (!_.isEmpty(authorization)) {
    const payload = jwt.verify(authorization, jwtToken, { ...proto[PVK].options.jwtVerifyOptions, complete: false });
    if (_.isObject(payload) && !_.isEmpty(payload.user)) {
      req.user = await proto.Query('User', { master: true }).get(payload.user);
      req.sessionId = payload.sessionId ?? (new UUID).toHexString();
    }
  }

  if (req.user instanceof TUser) {
    req.roles = await proto.userRoles(req.user);
  }

  signUser(proto, req, req.user);

  const user = req.header(MASTER_USER_HEADER_NAME);
  const pass = req.header(MASTER_PASS_HEADER_NAME);

  if (!_.isEmpty(user) && !_.isEmpty(pass)) {
    for (const profile of proto[PVK].options.masterUsers ?? []) {
      if (profile.user === user && profile.pass === pass) {
        req.isMaster = true;
      }
    }
  }

  return next();
};
