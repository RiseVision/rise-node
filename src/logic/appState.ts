import * as jsonpath from 'jsonpath';

/**
 * Container for modules and application loading state.
 */
export class AppState {
  public states = {};

  public set(what: string, value: any) {
    jsonpath.value(this.states, what, value);
  }

  public get(what: string): any {
    return jsonpath.value(this.states, what);
  }
}
