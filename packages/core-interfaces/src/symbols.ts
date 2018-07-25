export const Symbols = {
  helpers: {
    jobsQueue: Symbol.for('jobsQueue'),
    logger: Symbol.for('logger'),
    timeToEpoch: Symbol.for('timeToEpoch'),
  },
  logic: {
    account: Symbol.for('account'),
    appState: Symbol.for('appState'),
    block: Symbol.for('block'),
    blockReward: Symbol.for('blockReward'),
    broadcaster: Symbol.for('broadcaster'),
    peer: Symbol.for('peer'),
    peers: Symbol.for('peer'),
    transaction: Symbol.for('transaction'),
    txpool: Symbol.for('txPool'),
  },
  models: {
    accounts: Symbol.for('accountsModel'),
    blocks: Symbol.for('blocksModel'),
    forkStats: Symbol.for('forkStats'),
    info: Symbol.for('infoModel'),
    migrations: Symbol.for('migrations'),
    peers: Symbol.for('peers'),
    transactions: Symbol.for('transactions'),
  },
  modules: {
    accounts: Symbol.for('accountsModule'),
    blocks: Symbol.for('blocksModule'),
    fork: Symbol.for('forkModule'),
  }
};
