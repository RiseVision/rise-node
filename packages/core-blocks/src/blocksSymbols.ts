import { Symbols } from '@risevision/core-interfaces';

export const BlocksSymbols = {
  api    : Symbol.for('api'),
  logic: {
    block: Symbols.logic.block,
    blockReward: Symbols.logic.blockReward,
  },
  model: Symbols.models.blocks,
  modules: {
    blocks : Symbols.modules.blocks,
    chain  : Symbol.for('chainModule'),
    process: Symbol.for('processModule'),
    utils  : Symbol.for('utilsModule'),
    verify : Symbol.for('verifyModule'),
  },
};
