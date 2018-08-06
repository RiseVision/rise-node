import { Symbols } from '@risevision/core-interfaces';

export const CoreSymbols = {
  constants: Symbols.generic.constants,
  api: {
    loader: Symbol('loaderAPI'),
  },
  modules: {
    loader: Symbol('loaderModule'),
    system: Symbols.modules.system,
  },
};
