export const Symbols = {
  logic  : {
    transaction : Symbol('transaction'),
    transactions: {
      vote: Symbol('voteTransaction'),
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
  },
};
