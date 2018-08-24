import { Symbols } from '@risevision/core-interfaces';

export const HelpersSymbols = {
  appState: Symbols.logic.appState,
  crypto: Symbols.generic.crypto,
  jobsQueue: Symbols.helpers.jobsQueue,
  migrator: Symbol.for('rise.utils.migrator'),
  names: {
    balancesSequence: Symbols.names.helpers.balancesSequence,
    dbSequence: Symbols.names.helpers.dbSequence,
    defaultSequence: Symbols.names.helpers.defaultSequence,
  },
  sequence: Symbols.helpers.sequence,
};
