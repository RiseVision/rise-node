# RISE Node Core: Peer-to-peer Module

The Peer-to-peer (p2p) module provides the transport logic and network consensus algorithms between peers on the RISE network

## Overview

Peers communicate with each other through the `TransportAPI` using protocol buffers. There is a wide array of information exchanged between peers, and each node must validate the information the peers transmit, as well as the peer themselves. To do this the p2p module exposes functions for discovery and validation of peers. Most notably peers must attach a "Peer Header" which describes the Peer and must then be validated.

### Transport API

Because peers may request a wide variety of information about the status of the blockchain, transactions, delegates, etc; Transport API endpoints are not defined directly within this module, but rather within the data specific core modules themselves by defining a `RequestFactory` and making it available to the IoC container.

### Protocol Buffers

[Protocol Buffers](https://developers.google.com/protocol-buffers/) are high performing, serialized data structures for transmitting information (think JSON but smaller and faster). Protocol buffers require definitions for encoding and decoding requests / responses, which modules may define in a `MODULE_DIR/proto` directory.

## Providers

### APIs

* `TransportAPI`: A skeleton for [transport API endpoints](#transport-api) to be later injected by other modules
* `PeersAPI`: API to query node's peer list

### Models

* `PeersModel`: Peer ORM

### Logic

* `BroadcasterLogic`: Logic to propagate information to peers
* `PeersLogic`: Peer list management logic
* `Peer`: Peer Service to abstract interaction with Peers

### Modules

* `PeersModule`: Peer consensus and persistence service
* `TransportModule`: Peer retrieval, discovery and validation service

### Middleware

* `TransportWrapper`: Wrap / unwrap peer responses in Protocol buffers
* `AttachPeerHeaders`: Middleware to attach peer headers to request
* `ValidatePeerHeaders`: Middleware to validate peer headers from request

These Providers are exposed through a `CoreModule` which binds the Providers to an IoC Container

## Hooks

The peer-to-peer module also exposes a few hooks in the peer lifecycle

* `OnPeersReady` Action: Fired when peers are ready
* `FilterHeaders` Filter: Modify peer headers to be sent to other peers

## API

The Peers API endpoint can be found at `/api/peers`. Review [the API Reference](https://risevision.github.io/#tag/Peers-API) for more information.



