//
//  proto.ts
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
import axios from 'axios';
import { PVK } from '../private';
import type jwt from 'jsonwebtoken';
import type { CookieOptions, Request } from '@o2ter/server-js';
import type { SignOptions } from 'jsonwebtoken';
import { ExtraOptions } from '../options';
import { TQuery } from '../query';
import { TExtensions, TObjectType, TObjectTypes } from '../object/types';
import { TFile } from '../object/file';
import { FileData, FileStream } from '../buffer';
import { isObjKey } from '../utils';
import { applyObjectMethods } from '../object/methods';
import { TValue, TValueWithoutObject } from '../types';
import { TObject } from '../object';
import { TSerializable } from '../../common/codec';
import { TUser } from '../object/user';
import { ProtoFunction, ProtoFunctionOptions, ProtoJobFunction, ProtoJobFunctionOptions, ProtoTriggerFunction } from './types';
import { Socket } from 'socket.io-client';
import { Session } from '../../server/proto/session';
import { asyncStream } from '@o2ter/utils-js';
import { PathName } from '../query/types';
import { TRole } from '../object/role';
import { TJob } from '../object/job';
import { isFile, isJob, isObject, isQuery, isRole, isUser } from '../../common';
import { TQuerySelector } from '../query/types/selectors';

export const _logLevels = ['error', 'warn', 'info', 'debug', 'trace'] as const;
type _Logger = {
  [x in typeof _logLevels[number]]: (...args: any[]) => void;
};
export type Logger = _Logger & {
  loggerLevel: keyof _Logger | 'all' | 'none';
};

/**
 * The mode of the transaction.
 */
export type TransactionMode = 'default' | 'committed' | 'repeatable' | 'serializable';

/**
 * Options for configuring a transaction.
 */
export type TransactionOptions = {
  /**
   * The mode of the transaction.
   */
  mode?: TransactionMode;

  /**
   * The number of retries or a boolean indicating whether to retry.
   */
  retry?: number | boolean;
};

/**
 * Represents event data with additional metadata.
 */
export type EventData = Record<string, TValueWithoutObject> & {
  /**
   * The unique identifier for the event.
   */
  _id: string;

  /**
   * The creation date of the event.
   */
  _created_at: Date;

  /**
   * The read permissions for the event.
   */
  _rperm: string[];
};

export interface ProtoInternalType<Ext, P extends ProtoType<any>> {

  options: {
    endpoint: string;
    classExtends?: TExtensions<Ext>;
  };

  saveFile(proto: P, object: TFile, options?: ExtraOptions<boolean>): Promise<TFile>;
  deleteFile(proto: P, object: TFile, options?: ExtraOptions<boolean>): Promise<TFile>;
  fileData(proto: P, object: TFile, options?: ExtraOptions<boolean>): FileStream;

  liveQuery(proto: P, callback: (event: string, object: TObject) => void): { remove: VoidFunction; };
}

export abstract class ProtoType<Ext> {

  isQuery = isQuery;
  isObject = isObject;
  isUser = isUser;
  isRole = isRole;
  isFile = isFile;
  isJob = isJob;

  /** @internal */
  abstract [PVK]: ProtoInternalType<Ext, this>;

  /**
   * Retrieves the configuration.
   * @param options - Optional settings for retrieving the configuration.
   * @returns A promise that resolves to the configuration.
   */
  abstract config(options?: { master?: boolean; }): Promise<Record<string, TValueWithoutObject>>;

  /**
   * Retrieves the ACL of configuration.
   * @param options - Settings for retrieving the ACL of configuration.
   * @returns A promise that resolves to the ACL of configuration.
   */
  abstract configAcl(options: { master: true; }): PromiseLike<Record<string, string[]>>;

  /**
   * Sets the configuration.
   * @param values - The configuration values to set.
   * @param options - Settings for setting the configuration.
   * @returns A promise that resolves when the configuration is set.
   */
  abstract setConfig(values: Record<string, TValueWithoutObject>, options: { master: true; acl?: string[]; }): Promise<void>;

  /**
   * Runs a function.
   * @param name - The name of the function to run.
   * @param data - The data to pass to the function.
   * @param options - Additional options for running the function.
   * @returns A promise that resolves to the result of the function.
   */
  abstract run(name: string, data?: TSerializable, options?: ExtraOptions<boolean>): Promise<void | TSerializable>;

  /**
   * Schedules a job.
   * @param name - The name of the job to schedule.
   * @param params - The parameters to pass to the job.
   * @param options - Additional options for scheduling the job.
   * @returns A promise that resolves when the job is scheduled.
   */
  abstract scheduleJob(name: string, params?: TValueWithoutObject, options?: ExtraOptions<boolean>): Promise<TJob>;

  /**
   * Creates a query.
   * @param className - The name of the class to query.
   * @returns A query instance.
   */
  abstract Query<T extends string>(className: T): TQuery<T, Ext, boolean>;

  /**
   * Creates a relation query.
   * @param object - The object to create the relation for.
   * @param key - The key of the relation.
   * @returns A relation query instance.
   */
  abstract Relation<T extends string>(object: TObject, key: PathName<T>): TQuery<string, Ext, boolean>;

  /**
   * Get all references to an object.
   * @param object - The object to get references for.
   * @param options - Additional options for getting references.
   * @returns A stream of references.
   */
  abstract refs(object: TObject, options?: ExtraOptions<boolean>): ReturnType<typeof asyncStream<TObjectType<string, Ext>>>;

  /**
   * Checks if the server is online.
   * @returns A promise that resolves to a boolean indicating if the server is online.
   */
  async online() {
    try {
      const res = await axios({
        method: 'get',
        baseURL: this[PVK].options.endpoint,
        url: 'health',
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Rebinds an object to the proto instance.
   * @param object - The object to rebind.
   * @returns The rebinded object.
   */
  rebind<T extends TSerializable | undefined>(object: T): T {
    return applyObjectMethods(object, this);
  }

  /**
   * Creates a new object.
   * @param className - The name of the class to create.
   * @param objectId - The ID of the object to create.
   * @returns The created object.
   */
  Object<T extends string>(className: T, objectId?: string): TObjectType<T, Ext> {
    const attrs: Record<string, TValue> = objectId ? { _id: objectId } : {};
    const obj = isObjKey(className, TObjectTypes) ? new TObjectTypes[className](attrs) : new TObject(className, attrs);
    return this.rebind(obj as TObjectType<T, Ext>);
  }

  /**
   * Creates a new file object.
   * @param filename - The name of the file.
   * @param data - The file data.
   * @param type - The type of the file.
   * @returns The created file object.
   */
  File(filename: string, data: FileData, type?: string) {
    const file = this.Object('File');
    file.set('filename', filename);
    file.set('type', type);
    file[PVK].extra.data = data;
    return file;
  }

  /**
   * Notifies an event.
   * @param data - The data to notify.
   * @param options - Additional options for notifying the event.
   */
  abstract notify(
    data: Record<string, TValueWithoutObject> & { _rperm?: string[]; },
    options?: ExtraOptions<boolean>
  ): Promise<void>

  /**
   * Listens for events.
   * @param callback - The callback to call when an event occurs.
   * @returns An object with a remove function to stop listening.
   */
  abstract listen(
    callback: (data: EventData) => void,
    selector?: TQuerySelector
  ): {
    remove: VoidFunction;
    socket?: Socket;
  }
};

export interface ProtoType<Ext> {

  get logger(): Logger;

  /**
   * Connects a request with optional attributes.
   * @param req - The request to connect.
   * @param attrs - Optional attributes or a function returning attributes.
   * @returns The instance with the request and attributes.
   */
  connect<R extends Request, T extends object>(
    req: R,
    attrs?: T | ((x: this & { req: R; }) => T)
  ): this & { req: R; } & T;

  /**
   * Connects using a session token with optional attributes.
   * @param token - The session token.
   * @param attrs - Optional attributes or a function returning attributes.
   * @returns A promise resolving to the instance with the session and attributes.
   */
  connectWithSessionToken<T extends object>(
    token: string,
    attrs?: T | ((x: this & { session?: Session; }) => T)
  ): Promise<this & { session?: Session; } & T>

  /**
   * Sets the session token.
   * @param token - The session token.
   */
  setSessionToken(token?: string): void

  /**
   * Retrieves the roles of a user.
   * @param user - The user whose roles are to be retrieved.
   * @returns A promise resolving to an array of roles.
   */
  userRoles(user: TUser): Promise<TRole[]>;

  /**
   * Becomes a specified user.
   * @param req - The request.
   * @param user - The user to become.
   * @param options - Optional cookie and JWT sign options.
   * @returns A promise resolving to void.
   */
  becomeUser(
    req: Request,
    user: TUser,
    options?: {
      cookieOptions?: CookieOptions | undefined;
      jwtSignOptions?: SignOptions | undefined;
    }
  ): Promise<void>;

  /**
   * Logs out a user.
   * @param req - The request.
   * @param options - Optional cookie and JWT sign options.
   * @returns A promise resolving to void.
   */
  logoutUser(
    req: Request,
    options?: {
      cookieOptions?: CookieOptions | undefined;
      jwtSignOptions?: SignOptions | undefined;
    }
  ): Promise<void>;

  /**
   * Verifies a user's password.
   * @param user - The user whose password is to be verified.
   * @param password - The password to verify.
   * @param options - Extra options.
   * @returns A promise resolving to a boolean indicating if the password is correct.
   */
  varifyPassword(user: TUser, password: string, options: ExtraOptions<true>): Promise<boolean>;

  /**
   * Sets a user's password.
   * @param user - The user whose password is to be set.
   * @param password - The new password.
   * @param options - Extra options.
   * @returns A promise resolving to void.
   */
  setPassword(user: TUser, password: string, options: ExtraOptions<true>): Promise<void>;

  /**
   * Unsets a user's password.
   * @param user - The user whose password is to be unset.
   * @param options - Extra options.
   * @returns A promise resolving to void.
   */
  unsetPassword(user: TUser, options: ExtraOptions<true>): Promise<void>;

  /**
   * Defines a new function.
   * @param name - The name of the function.
   * @param callback - The function callback.
   * @param options - Optional function options excluding the callback.
   */
  define(
    name: string,
    callback: ProtoFunction<Ext>,
    options?: Omit<ProtoFunctionOptions<Ext>, 'callback'>,
  ): void;

  /**
   * Registers a callback to be executed after an object is created.
   * @param className - The name of the class.
   * @param callback - The callback function.
   */
  afterCreate<T extends string>(
    className: string,
    callback: ProtoTriggerFunction<T, Ext>,
  ): void;

  /**
   * Registers a callback to be executed after an object is updated.
   * @param className - The name of the class.
   * @param callback - The callback function.
   */
  afterUpdate<T extends string>(
    className: string,
    callback: ProtoTriggerFunction<T, Ext>,
  ): void;

  /**
   * Registers a callback to be executed after an object is deleted.
   * @param className - The name of the class.
   * @param callback - The callback function.
   */
  afterDelete<T extends string>(
    className: string,
    callback: ProtoTriggerFunction<T, Ext>,
  ): void;

  /**
   * Defines a new job function.
   * @param name - The name of the job function.
   * @param callback - The job function callback.
   * @param options - Optional job function options excluding the callback.
   */
  defineJob(
    name: string,
    callback: ProtoJobFunction<Ext>,
    options?: Omit<ProtoJobFunctionOptions<Ext>, 'callback'>,
  ): void;

  /**
   * Locks a table for updates.
   * @param className - The name of the class or an array of class names.
   * @param update - Whether to lock for update.
   */
  lockTable(className: string | string[], update: boolean): void;

  /**
   * Executes a callback within a transaction.
   * @param callback - The callback to execute.
   * @param options - Optional transaction options.
   */
  withTransaction<T>(
    callback: (connection: ProtoType<Ext>) => PromiseLike<T>,
    options?: TransactionOptions,
  ): void;

  /**
   * Generates an upload token.
   * @param options - Optional settings for the upload token.
   * @returns The generated upload token.
   */
  generateUploadToken(
    options?: { maxUploadSize?: number; }
  ): string;

  /**
   * Signs a JWT.
   * @param payload - The payload to sign.
   * @param options - Options for signing the JWT.
   * @returns The signed JWT.
   */
  jwtSign(payload: any, options: jwt.SignOptions): string;

  /**
   * Verifies a JWT.
   * @param token - The token to verify.
   * @param options - Options for verifying the JWT.
   * @returns The decoded JWT payload or undefined if verification fails.
   */
  jwtVarify(token: string, options?: jwt.VerifyOptions): jwt.JwtPayload | undefined;
};
