import { Symbols } from '@risevision/core-interfaces';

export const p2pSymbols = {
  constants : Symbol.for('rise.p2p.p2pConstants'),
  express   : Symbol.for('rise.p2p.express'),
  server    : Symbol.for('rise.p2p.server'),
  socketIO  : Symbols.generic.socketIO,
  // Tag your HTTP controller with this.
  controller: Symbol.for('rise.p2p.controller'),
  middleware: Symbol.for('rise.p2p.middleware'),
  helpers: {
    protoBuf: Symbol.for('rise.p2p.protobufHelper'),
  },
  modules   : {
    peers    : Symbols.modules.peers,
    transport: Symbols.modules.transport,
  },
  api       : {
    attachPeerHeaders            : Symbol.for('rise.p2p.attachPeerHeaders'),
    peersAPI                     : Symbol.for('rise.p2p.peersAPI'),
    transport                    : Symbol.for('rise.p2p.transport'),
    transportV2                  : Symbol.for('rise.p2p.transportV2'),
    validatePeerHeadersMiddleware: Symbol.for('rise.p2p.validatePeerHeadersMiddleware'),
  },
  logic     : {
    broadcaster: Symbols.logic.broadcaster,
    peerFactory: Symbol.for('rise.p2p.peerFactory'),
    peerLogic  : Symbols.logic.peer,
    peersLogic : Symbols.logic.peers,
  },
  utils: {
    v2ErrorHandler: Symbol.for('rise.p2p.v2ErrorHandler'),
  },
  requests: {
    commonBlocks    : Symbol.for('rise.p2p.getCommonBlocks'),
    getBlocks       : Symbol.for('rise.p2p.getBlocks'),
    getTransactions : Symbol.for('rise.p2p.getTransactions'),
    height          : Symbol.for('rise.p2p.height'),
    peersList       : Symbol.for('rise.p2p.peersList'),
    ping            : Symbol.for('rise.p2p.ping'),
    postBlocks      : Symbol.for('rise.p2p.postBlocks'),
    postTransactions: Symbol.for('rise.p2p.postTransactions'),
  },
  model     : Symbol.for('rise.p2p.peersmodel'),
};
