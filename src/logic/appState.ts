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

  /**
   * Set a value for a key
   */
  public set(what: string, value: any) {
    jsonpath.value(this.states, `$.${what}`, value);
  }

  /**
   * Set a computed value for a key
   */
  public setComputed(what: string, value: any) {
    jsonpath.value(this.computed, `$.${what}`, value);
  }

  /**
   * Get computed value of a key
   */
  public getComputed(what: string): any {
    const fn = jsonpath.value(this.computed, `$.${what}`);
    if (typeof(fn) !== 'function') {
      return undefined;
    }
    return fn(this);
  }

  /**
   * Get value of a key
   */
  public get(what: string): any {
    return jsonpath.value(this.states, `$.${what}`);
  }
}
