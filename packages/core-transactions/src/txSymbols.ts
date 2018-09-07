import { Symbols } from '@risevision/core-interfaces';

export const TXSymbols = {
  api        : {
    api      : Symbol.for('rise.txs.api.transactionsAPI'),
    transport: Symbol.for('rise.txs.api.transportAPI')
  },
  logic      : Symbols.logic.transaction,
  model      : Symbols.models.transactions,
  module     : Symbols.modules.transactions,
  p2p        : {
    getTransactions: Symbol.for('rise.txs.p2p.getTransactions'),
    postTxRequest  : Symbol.for('rise.txs.p2p.postTransaction'),
  },
  pool       : Symbols.logic.txpool,
  sendTX     : Symbol.for('rise.txs.sendTX'),
  transaction: Symbol.for('rise.txs.transaction'),
};
