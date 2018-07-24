export const BlocksSymbols = {
  api    : Symbol.for('api'),
  logic: {
    block: Symbol.for('blockLogic'),
    blockReward: Symbol.for('blockReward'),
  },
  modules: {
    blocks : Symbol.for('blocksModule'),
    chain  : Symbol.for('chainModule'),
    process: Symbol.for('processModule'),
    utils  : Symbol.for('utilsModule'),
    verify : Symbol.for('verifyModule'),
  },
};
