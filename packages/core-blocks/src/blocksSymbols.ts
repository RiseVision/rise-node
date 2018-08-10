import { Symbols } from '@risevision/core-interfaces';

export const BlocksSymbols = {
  api    : Symbol.for('rise.blocks.api'),
  logic: {
    block: Symbols.logic.block,
    blockReward: Symbols.logic.blockReward,
  },
  model: Symbols.models.blocks,
  modules: {
    blocks : Symbols.modules.blocks,
    chain  : Symbol.for('rise.blocks.chainModule'),
    process: Symbol.for('rise.blocks.processModule'),
    utils  : Symbol.for('rise.blocks.utilsModule'),
    verify : Symbol.for('rise.blocks.verifyModule'),
  },
};
