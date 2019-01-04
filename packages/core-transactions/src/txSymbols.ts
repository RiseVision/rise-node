import { Symbols } from '@risevision/core-interfaces';

export const TXSymbols = {
  api: {
    api: Symbol.for('rise.txs.api.transactionsAPI'),
    transport: Symbol.for('rise.txs.api.transportAPI'),
  },
  loader: Symbol.for('rise.txs.loader'),
  logic: Symbols.logic.transaction,
  // model: Symbols.models.transactions,
  models: {
    model: Symbols.models.transactions,
    sendTxAsset: Symbol.for('rise.txs.models.sendTxAsset'),
  },
  module: Symbols.modules.transactions,
  p2p: {
    codecs: Symbol.for('rise.txs.p2p.codecs'),
    getTransactions: Symbol.for('rise.txs.p2p.getTransactions'),
    postTxRequest: Symbol.for('rise.txs.p2p.postTransaction'),
  },
  pool: Symbols.logic.txpool,
  poolManager: Symbol.for('rise.txs.poolManager'),
  poolQueue: Symbol.for('rise.txs.poolQueue'),
  sendTX: Symbol.for('rise.txs.sendTX'),
  transaction: Symbol.for('rise.txs.transaction'),
  txBytes: Symbol.for('rise.txs.txBytes'),
};
