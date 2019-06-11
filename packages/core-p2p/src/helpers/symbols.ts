import { Symbols } from '@risevision/core-types';
// tslint:disable object-literal-sort-keys

export const p2pSymbols = {
  constants: Symbol.for('rise.p2p.p2pConstants'),
  express: Symbol.for('rise.p2p.express'),
  server: Symbol.for('rise.p2p.server'),
  socketIO: Symbols.generic.socketIO,
  // Tag your HTTP controller with this.
  controller: Symbol.for('rise.p2p.controller'),
  middleware: Symbol.for('rise.p2p.middleware'),
  transportMethod: Symbol.for('rise.p2p.transportMethod'),
  transportMiddleware: Symbol.for('rise.p2p.transportMiddleware'),
  transportMiddlewares: {
    validatePeer: Symbol.for('rise.p2p.validatePeerHeadersMiddleware'),
  },
  helpers: {
    protoBuf: Symbol.for('rise.p2p.protobufHelper'),
  },
  modules: {
    peers: Symbols.modules.peers,
    transport: Symbols.modules.transport,
  },
  api: {
    peersAPI: Symbol.for('rise.p2p.peersAPI'),
    transport: Symbol.for('rise.p2p.transport'),
  },
  logic: {
    broadcaster: Symbols.logic.broadcaster,
    peerFactory: Symbol.for('rise.p2p.peerFactory'),
    peerLogic: Symbols.logic.peer,
    peersLogic: Symbols.logic.peers,
  },
  utils: {
    transportWrapper: Symbol.for('rise.p2p.transportWrapper'),
    v2ErrorHandler: Symbol.for('rise.p2p.v2ErrorHandler'),
  },
  requests: {
    ping: Symbol.for('rise.p2p.ping'),
    modules: Symbol.for('rise.p2p.modules'),
    peersList: Symbol.for('rise.p2p.peersList'),
  },
  model: Symbols.models.peers,
  __internals: {
    loadSubscriber: Symbol.for('rise.p2p.__internals.loadsubscriber'),
    resolvedTransportMethods: Symbol.for(
      'rise.p2p.__internals.resolvedTransportMethods'
    ),
    resolvedTransportMiddlewares: Symbol.for(
      'rise.p2p.__internals.resolvedTransportMiddlewares'
    ),
  },
};
