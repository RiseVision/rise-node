export const CoreSymbols = {
  appConfig: Symbol.for('appConfig'),
  api: {
    accounts: Symbol.for('accountsAPI'),
    blocks: Symbol.for('blocksAPI'),
    loader: Symbol.for('loaderAPI'),
  },
  modules: {
    accounts: Symbol.for('accountsModule'),
    system: Symbol.for('systemModule'),
  },
  logic: {
    account: Symbol.for('accountLogic'),
    appState: Symbol.for('appState'),
    block: Symbol.for('block'),
    blockReward: Symbol.for('blockReward'),

  }
};
