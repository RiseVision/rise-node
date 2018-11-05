import { Symbols } from '@risevision/core-interfaces';

export const AccountsSymbols = {
  api: Symbol.for('rise.accounts.api'),
  logic: Symbols.logic.account,
  model: Symbols.models.accounts,
  module: Symbols.modules.accounts,
  // tslint:disable-next-line
  __internal: {
    loaderHooks: Symbol.for('rise.accounts.hooks.loader'),
  },
};
