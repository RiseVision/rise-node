import { Symbols } from '@risevision/core-interfaces';

export const BlocksSymbols = {
  api    : Symbol('api'),
  logic: {
    block: Symbols.logic.block,
    blockReward: Symbols.logic.blockReward,
  },
  model: Symbols.models.blocks,
  modules: {
    blocks : Symbols.modules.blocks,
    chain  : Symbol('chainModule'),
    process: Symbol('processModule'),
    utils  : Symbol('utilsModule'),
    verify : Symbol('verifyModule'),
  },
};
