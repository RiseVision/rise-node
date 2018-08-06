export const dPoSSymbols = {
  delegatesAPI: Symbol('delegatesAPI'),
  dposConstants: Symbol('dposConstants'),
  helpers      : {
    roundChanges: Symbol('roundChanges'),
    slots       : Symbol('slots'),
  },
  logic: {
    delegateTransaction: Symbol('delegateTransaction'),
    round: Symbol('roundLogic'),
    rounds: Symbol('roundsLogic'),
  },
  models       : {
    accounts2Delegates : Symbol('accounts2Delegates'),
    accounts2UDelegates: Symbol('accounts2UDelegates'),
    delegates          : Symbol('delegates'),
    rounds             : Symbol('rounds'),
    roundsFees         : Symbol('roundsFees'),
    votes              : Symbol('votes'),
  },
  modules: {
    delegates: Symbol('delegatesModel'),
    forge: Symbol('fogeModel'),
  },
};
