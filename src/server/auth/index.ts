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
import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Proto } from '../index';
import { PVK, TRole, TUser } from '../../internals';
import {
  AUTH_COOKIE_KEY,
  MASTER_KEY_HEADER_NAME,
  MASTER_PASS_HEADER_NAME,
  MASTER_USER_HEADER_NAME,
} from '../../common/const';

export default <E>(proto: Proto<E>, jwtToken?: string): RequestHandler => async (req: any, res, next) => {

  if (_.isNil(jwtToken)) return next();

  const key = req.header(MASTER_KEY_HEADER_NAME);
  const user = req.header(MASTER_USER_HEADER_NAME);
  const pass = req.header(MASTER_PASS_HEADER_NAME);

  if (!_.isEmpty(key)) {
    const masterKey = proto[PVK].options.masterKey;
    req.isMaster = !_.isEmpty(masterKey) && key === masterKey;
  } else if (!_.isEmpty(user) && !_.isEmpty(pass)) {
    for (const profile of proto[PVK].options.masterUsers ?? []) {
      if (profile.user === user && profile.pass === pass) {
        req.isMaster = true;
      }
    }
  }

  let authorization = '';
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') authorization = parts[1];
  } else if (req.cookies[AUTH_COOKIE_KEY]) {
    authorization = req.cookies[AUTH_COOKIE_KEY];
  }

  if (!_.isEmpty(authorization)) {
    const payload = jwt.verify(authorization, jwtToken);
    if (_.isObject(payload) && !_.isEmpty(payload.user)) {
      req.user = await proto.Query('_User', { master: true }).get(payload.user);
      req.isMaster = payload.master;
    }
  }

  if (req.user instanceof TUser) {
    let roles: TRole[] = [];
    let queue = await proto.Query('_Role', { master: true })
      .containsIn('users', req.user)
      .find();
    while (!_.isEmpty(queue)) {
      queue = await proto.Query('_Role', { master: true })
        .isIntersect('_roles', queue)
        .notContainsIn('_id', _.compact(_.map(roles, x => x.objectId)))
        .find();
      roles = _.uniqBy([...roles, ...queue], x => x.objectId);
    }
    req.roles = roles;
  }

  const token = jwt.sign({
    user: req.user?._id,
    master: req.isMaster,
  }, jwtToken);

  res.cookie(AUTH_COOKIE_KEY, token);
  return next();
};
