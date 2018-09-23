import { Symbols } from '@risevision/core-interfaces';

export const BlocksSymbols = {
  api    : {
    api      : Symbol.for('rise.blocks.api.api'),
    transport: Symbol.for('rise.blocks.api.transport'),
  },
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
  p2p: {
    commonBlocks: Symbol.for('rise.blocks.p2p.getCommonBlocks'),
    getBlocks   : Symbol.for('rise.blocks.p2p.getBlocks'),
    getHeight   : Symbol.for('rise.blocks.p2p.getHeight'),
    postBlock   : Symbol.for('rise.blocks.p2p.post'),
  },
};
