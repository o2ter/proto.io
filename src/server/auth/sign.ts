//
//  sign.ts
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
import { Response } from 'express';
import { ProtoService } from '../proto/index';
import { PVK, TUser, UUID } from '../../internals';
import { AUTH_COOKIE_KEY } from '../../common/const';

export function signUser<E>(proto: ProtoService<E>, res: Response, user?: TUser) {
  const jwtToken = proto[PVK].options.jwtToken;
  if (_.isNil(jwtToken)) return;
  const token = jwt.sign({ user: user?.objectId, sessionId: proto.sessionId ?? (new UUID).toHexString() }, jwtToken, proto[PVK].options.jwtSignOptions);
  res.cookie(AUTH_COOKIE_KEY, token, proto[PVK].options.cookieOptions);
}
