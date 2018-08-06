import { Symbols } from '@risevision/core-interfaces';

export const p2pSymbols = {
  constants : Symbol('p2pConstants'),
  express   : Symbol('express'),
  server    : Symbol('server'),
  socketIO  : Symbols.generic.socketIO,
  // Tag your HTTP controller with this.
  controller: Symbol('controller'),
  middleware: Symbol('middleware'),
  modules   : {
    peers    : Symbols.modules.peers,
    transport: Symbols.modules.transport,
  },
  api       : {
    attachPeerHeaders            : Symbol('attachPeerHeaders'),
    peersAPI                     : Symbol('peersAPI'),
    transport                    : Symbol('transport'),
    validatePeerHeadersMiddleware: Symbol('validatePeerHeadersMiddleware'),
  },
  logic     : {
    broadcaster: Symbols.logic.broadcaster,
    peerFactory: Symbol('peerFactory'),
    peerLogic  : Symbols.logic.peer,
    peersLogic : Symbols.logic.peers,
  },
  model     : Symbol('peersmodel'),
};
