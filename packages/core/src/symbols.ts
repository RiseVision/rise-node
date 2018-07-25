import { Symbols } from '@risevision/core-interfaces';

export const CoreSymbols = {
  api: {
    loader: Symbol.for('loaderAPI'),
  },
  modules: {
    loader: Symbol.for('loaderModule'),
    system: Symbols.modules.system,
  },
};
