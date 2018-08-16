export const dPoSSymbols = {
  accountsAPI : Symbol.for('rise.dpos.accountsAPI'),
  delegatesAPI: Symbol.for('rise.dpos.delegatesAPI'),
  helpers     : {
    roundChanges: Symbol.for('rise.dpos.roundChanges'),
    slots       : Symbol.for('rise.dpos.slots'),
  },
  logic       : {
    delegateTransaction: Symbol.for('rise.dpos.delegateTransaction'),
    voteTransaction    : Symbol.for('rise.dpos.voteTransaction'),
    round              : Symbol.for('rise.dpos.roundLogic'),
    rounds             : Symbol.for('rise.dpos.roundsLogic'),
  },
  models      : {
    accounts2Delegates : Symbol.for('rise.dpos.accounts2Delegates'),
    accounts2UDelegates: Symbol.for('rise.dpos.accounts2UDelegates'),
    delegates          : Symbol.for('rise.dpos.delegates'),
    rounds             : Symbol.for('rise.dpos.rounds'),
    roundsFees         : Symbol.for('rise.dpos.roundsFees'),
    votes              : Symbol.for('rise.dpos.votes'),
  },
  modules     : {
    delegates: Symbol.for('rise.dpos.delegatesModule'),
    forge    : Symbol.for('rise.dpos.forgeModule'),
    rounds   : Symbol.for('rise.dpos.roundsModule'),
  },
};
