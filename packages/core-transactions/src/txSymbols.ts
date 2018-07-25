import {Symbols} from '@risevision/core-interfaces';

export const TXSymbols = {
  api        : Symbol.for('transactionsAPI'),
  logic      : Symbols.logic.transaction,
  model      : Symbols.models.transactions,
  module     : Symbols.modules.transactions,
  pool       : Symbol.for('pool'),
  sendTX     : Symbol.for('sendTX'),
};
