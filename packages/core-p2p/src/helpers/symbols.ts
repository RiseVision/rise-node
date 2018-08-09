import { Symbols } from '@risevision/core-interfaces';

export const p2pSymbols = {
  constants : Symbol.for('rise.p2p.p2pConstants'),
  express   : Symbol.for('rise.p2p.express'),
  server    : Symbol.for('rise.p2p.server'),
  socketIO  : Symbols.generic.socketIO,
  // Tag your HTTP controller with this.
  controller: Symbol.for('rise.p2p.controller'),
  middleware: Symbol.for('rise.p2p.middleware'),
  modules   : {
    peers    : Symbols.modules.peers,
    transport: Symbols.modules.transport,
  },
  api       : {
    attachPeerHeaders            : Symbol.for('rise.p2p.attachPeerHeaders'),
    peersAPI                     : Symbol.for('rise.p2p.peersAPI'),
    transport                    : Symbol.for('rise.p2p.transport'),
    validatePeerHeadersMiddleware: Symbol.for('rise.p2p.validatePeerHeadersMiddleware'),
  },
  logic     : {
    broadcaster: Symbols.logic.broadcaster,
    peerFactory: Symbol.for('rise.p2p.peerFactory'),
    peerLogic  : Symbols.logic.peer,
    peersLogic : Symbols.logic.peers,
  },
  model     : Symbol.for('rise.p2p.peersmodel'),
};

