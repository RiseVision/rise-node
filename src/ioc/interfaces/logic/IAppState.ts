// tslint:disable unified-signatures

export interface IAppState {
  set(what: 'rounds.isTicking', value: boolean);

  set(what: 'rounds.isLoaded', value: boolean);

  set(what: 'loader.isSyncing', value: boolean);

  set(what: 'node.consensus', value: number);

  set(what: 'rounds.snapshot', value: number);

  setComputed(what: 'node.poorConsensus', fn: (as: IAppState) => boolean);

  get(what: 'rounds.isTicking'): boolean;

  get(what: 'rounds.isLoaded'): boolean;

  get(what: 'loader.isSyncing'): boolean;

  get(what: 'node.consensus'): number;

  get(what: 'rounds.snapshot'): number;

  getComputed(what: 'node.poorConsensus'): boolean;
}
