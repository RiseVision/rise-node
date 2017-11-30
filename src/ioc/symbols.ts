export const Symbols = {
  logic  : {
    transaction : Symbol('transaction'),
    transactions: {
      vote: Symbol('voteTransaction'),
    },
  },
  modules: {
    accounts        : Symbol('accounts module'),
    blocksSubModules: {
      chain  : Symbol('blocks_submodule_chain'),
      process: Symbol('blocks_submodule_process'),
      utils  : Symbol('blocks_submodule_utils'),
      verify : Symbol('blocks_submodule_verify'),
    },
    delegates       : Symbol('delegates module'),
    system          : Symbol('system module'),
  },
};
