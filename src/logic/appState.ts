import { injectable } from 'inversify';
import * as jsonpath from 'jsonpath';
import { IAppState } from '../ioc/interfaces/logic';

/**
 * Container for modules and application loading state.
 */
@injectable()
export class AppState implements IAppState {
  public states = {};
  public computed = {};

  public set(what: string, value: any) {
    jsonpath.value(this.states, `$.${what}`, value);
  }

  public setComputed(what: string, value: any) {
    jsonpath.value(this.computed, `$.${what}`, value);
  }

  public getComputed(what: string): any {
    const fn = jsonpath.value(this.computed, `$.${what}`);
    if (typeof(fn) !== 'function') {
      return undefined;
    }
    return fn(this);
  }

  public get(what: string): any {
    return jsonpath.value(this.states, `$.${what}`);
  }
}
