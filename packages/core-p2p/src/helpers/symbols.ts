export const p2pSymbols = {
  constants: Symbol.for('p2pSymbol'),
  express: Symbol.for('express'),
  server: Symbol.for('server'),
  // Tag your HTTP controller with this.
  controller: Symbol.for('controller'),
  middleware: Symbol.for('middleware'),
  api  : {
    attachPeerHeaders            : Symbol.for('attachPeerHeaders'),
    peersAPI                     : Symbol.for('peersAPI'),
    transport                    : Symbol.for('transport'),
    validatePeerHeadersMiddleware: Symbol.for('validatePeerHeadersMiddleware'),
  },
  logic: {
    peerFactory: Symbol.for('peerFactory'),
  },
  model: Symbol('peersmodel'),
};
