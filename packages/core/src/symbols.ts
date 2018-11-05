import { Symbols } from '@risevision/core-interfaces';
// tslint:disable object-literal-sort-keys
export const CoreSymbols = {
  constants: Symbols.generic.constants,
  api: {
    loader: Symbol.for('loaderAPI'),
  },
  modules: {
    fork: Symbols.modules.fork,
    loader: Symbol.for('loaderModule'),
    system: Symbols.modules.system,
  },
};
