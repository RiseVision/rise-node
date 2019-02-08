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

## API

The Peers API endpoint can be found at `/api/peers`. Review [the API Reference](https://risevision.github.io/#tag/Peers-API) for more information.


## Authors
- Andrea B. <vekexasia+crypto@gmail.com>
- Jan <lepetitjan@icloud.com>
- Mariusz Serek <mariusz@serek.net>
- Goldeneye (Shift Team)
- Ralfs (Shift Team)
- Joey <shiftcurrency@gmail.com>
- Boris Povod <boris@crypti.me>
- Pavel Nekrasov <landgraf.paul@gmail.com>
- Sebastian Stupurac <stupurac.sebastian@gmail.com>
- Oliver Beddows <oliver@lightcurve.io>
- Isabella Dell <isabella@lightcurve.io>
- Marius Serek <mariusz@serek.net>
- Maciej Baj <maciej@lightcurve.io>


## License

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>  
Copyright © 2016-2017 Lisk Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the [GNU General Public License](https://github.com/RiseVision/rise-node/src/master/LICENSE) along with this program.  If not, see <http://www.gnu.org/licenses/>.

***

This program also incorporates work previously released with lisk `0.7.0` (and earlier) versions under the [MIT License](https://opensource.org/licenses/MIT). To comply with the requirements of that license, the following permission notice, applicable to those parts of the code only, is included below:

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>
Copyright © 2016-2017 Lisk Foundation<br>  
Copyright © 2015 Crypti

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

