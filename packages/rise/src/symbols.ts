export const RISESymbols = {
  helpers: {
    constants: Symbol.for('risemodule.helpers.constants'),
    upgrader: Symbol.for('risemodule.helpers.upgrader'),
  },
  models: {
    oldVotesModel: Symbol.for('risemodule.models.oldVotesModel'),
  },
  oldtxs: {
    delegate: Symbol.for('risemodule.oldtxs.delegate'),
    secondSign: Symbol.for('risemodule.oldtxs.secondSign'),
    send: Symbol.for('risemodule.oldtxs.send'),
    vote: Symbol.for('risemodule.oldtxs.vote'),
  },
};
