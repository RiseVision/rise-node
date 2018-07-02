export const dPoSSymbols = {
  delegatesAPI: Symbol.for('delegatesAPI'),
  dposConstants: Symbol.for('dposConstants'),
  helpers      : {
    roundChanges: Symbol.for('roundChanges'),
    slots       : Symbol.for('slots'),
  },
  logic: {
    delegateTransaction: Symbol.for('delegateTransaction'),
    round: Symbol.for('roundLogic'),
    rounds: Symbol.for('roundsLogic'),
  },
  models       : {
    accounts2Delegates : Symbol.for('accounts2Delegates'),
    accounts2UDelegates: Symbol.for('accounts2UDelegates'),
    delegates          : Symbol.for('delegates'),
    rounds             : Symbol.for('rounds'),
    roundsFees         : Symbol.for('roundsFees'),
    votes              : Symbol.for('votes'),
  },
  modules: {
    delegates: Symbol.for('delegatesModel'),
    forge: Symbol.for('fogeModel'),
  },
};
