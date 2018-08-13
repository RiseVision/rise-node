export const MultisigSymbols = {
  api              : Symbol.for('rise.multisig.API'),
  module           : Symbol.for('rise.multisig.Module'),
  multisigConstants: Symbol.for('rise.multisig.Constants'),
  tx               : Symbol.for('rise.multisig.tx'),
  models           : {
    accounts2Multi  : Symbol.for('rise.multisig.accounts2Multi'),
    accounts2U_Multi: Symbol.for('rise.multisig.accounts2U_Multi'),
    model           : Symbol.for('rise.multisig.multisigModel'),
  },
  multiSigTransport: Symbol.for('rise.multisig.transport'),
};
