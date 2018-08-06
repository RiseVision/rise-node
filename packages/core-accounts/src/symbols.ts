import { Symbols } from '@risevision/core-interfaces';

export const AccountsSymbols = {
  api   : Symbol.for('accountsAPI'),
  logic : Symbols.logic.account,
  model : Symbols.models.accounts,
  module: Symbols.modules.accounts,
};

