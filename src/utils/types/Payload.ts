import _ from 'lodash';
import { IOSerializable } from '../codec';
import { RouteOptions } from './RouteOptions';

export class Payload {

  options: RouteOptions;

  constructor(options: RouteOptions) {
    this.options = options;
  }

  async run(name: string, data?: IOSerializable) {
    const func = this.options.functions?.[name];
    const payload = Object.setPrototypeOf({
      data: data ?? null,
    }, this);
    return _.isFunction(func) ? func(payload) : null;
  }
}
