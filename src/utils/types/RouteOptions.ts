import { IOSerializable } from '../codec';
import { Payload } from './Payload';

export type RouteOptions = {
  token?: string;
  functions?: Record<string, (request: Payload & {
    data: IOSerializable;
  }) => IOSerializable | Promise<IOSerializable>>;
};
