import {Symbols} from '@risevision/core-interfaces';

export const TXSymbols = {
  api        : Symbol('transactionsAPI'),
  logic      : Symbols.logic.transaction,
  model      : Symbols.models.transactions,
  module     : Symbols.modules.transactions,
  pool       : Symbol('pool'),
  sendTX     : Symbol('sendTX'),
  transaction: Symbol('transaction'),
};
