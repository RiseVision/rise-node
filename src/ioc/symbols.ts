export const Symbols = {
  logic  : {
    account     : Symbol('account'),
    block       : Symbol('block'),
    blockReward : Symbol('blockReward'),
    broadcaster : Symbol('broadcaster'),
    peer        : Symbol('peer'),
    peers       : Symbol('peers'),
    round       : Symbol('round'),
    transaction : Symbol('transaction'),
    transactions: {
      createmultisig : Symbol('createMultisigTx'),
      delegate       : Symbol('delegateTx'),
      secondSignature: Symbol('secondSignatureTx'),
      send           : Symbol('sendTx'),
      vote           : Symbol('voteTx'),
    },

  },
  modules: {
    accounts        : Symbol('accounts module'),
    blocks          : Symbol('blocks module'),
    blocksSubModules: {
      chain  : Symbol('blocks_submodule_chain'),
      process: Symbol('blocks_submodule_process'),
      utils  : Symbol('blocks_submodule_utils'),
      verify : Symbol('blocks_submodule_verify'),
    },
    cache           : Symbol('cache module'),
    delegates       : Symbol('delegates module'),
    multisignatures : Symbol('multisignatures module'),
    system          : Symbol('system module'),
    transactions    : Symbol('transactions module'),
    transport       : Symbol('transport module'),
  },
};
