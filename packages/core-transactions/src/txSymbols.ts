import {Symbols} from '@risevision/core-interfaces';

export const TXSymbols = {
  api        : Symbol.for('rise.txs.transactionsAPI'),
  logic      : Symbols.logic.transaction,
  model      : Symbols.models.transactions,
  module     : Symbols.modules.transactions,
  pool       : Symbols.logic.txpool,
  sendTX     : Symbol.for('rise.txs.sendTX'),
  transaction: Symbol.for('rise.txs.transaction'),
};
