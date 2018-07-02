// tslint:disable unified-signatures

export interface IAppState {

  /**
   * Set a value for 'rounds.isTicking' key.
   */
  set(what: 'rounds.isTicking', value: boolean);

  /**
   * Set a value for 'rounds.isLoaded' key.
   */
  set(what: 'rounds.isLoaded', value: boolean);

  /**
   * Set a value for 'loader.isSyncing' key.
   */
  set(what: 'loader.isSyncing', value: boolean);

  /**
   * Set a value for 'node.consensus' key.
   */
  set(what: 'node.consensus', value: number);

  /**
   * Set a value for 'rounds.snapshot' key.
   */
  set(what: 'rounds.snapshot', value: number);

  /**
   * Set a computed value for 'node.poorConsensus' key.
   */
  setComputed(what: 'node.poorConsensus', fn: (as: IAppState) => boolean);

  /**
   * Get value of 'rounds.isTicking' key.
   */
  get(what: 'rounds.isTicking'): boolean;

  /**
   * Get value of 'rounds.isLoaded' key.
   */
  get(what: 'rounds.isLoaded'): boolean;

  /**
   * Get value of 'loader.isSyncing' key.
   */
  get(what: 'loader.isSyncing'): boolean;

  /**
   * Get value of 'node.consensus' key.
   */
  get(what: 'node.consensus'): number;

  /**
   * Get value of 'rounds.snapshot' key.
   */
  get(what: 'rounds.snapshot'): number;

  /**
   * Get computed value of 'node.poorConsensus' key.
   */
  getComputed(what: 'node.poorConsensus'): boolean;
}
