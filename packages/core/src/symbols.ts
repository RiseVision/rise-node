import { Symbols } from '@risevision/core-interfaces';
// tslint:disable object-literal-sort-keys
export const CoreSymbols = {
  constants: Symbols.generic.constants,
  api: {
    loader: Symbol.for('loaderAPI'),
  },
  helpers: {
    migrator: Symbol.for('rise.core.helpers.migrator'),
  },
  models: {
    info: Symbol.for('rise.core.models.info'),
    migrations: Symbol.for('rise.core.models.migrations'),
  },
  modules: {
    fork: Symbols.modules.fork,
    loader: Symbol.for('loaderModule'),
    system: Symbols.modules.system,
  },
  // tslint:disable-next-line
  __internals: {
    blockMonitor: Symbol.for('rise.core.internals.blockMonitor'),
  },
};
