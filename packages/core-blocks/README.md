# RISE Node Core: Blocks Module

The Blocks Module defines the database tables, logic and API endpoints for working with the RISE blockchain

## Overview

Blocks are the unit of the blockchain and represent a group of transactions. This module deals with creating, signing, verifying, loading and applying blocks to the blockchain, as well as provides querying methods for analyzing the status of the blockchain and fetching blocks.

## Providers

The Blocks Module provides the following Providers:

### Modules

* `BlocksModuleChain`: Service provider for applying blocks to the block chain
* `BlocksModuleUtils`: Utilities for querying blocks on the blockchain
* `BlocksModuleProcess`: Service provider for generating / loading new blocks
* `BlocksModuleVerify`: Service provider for verifying block integrity

### Model

* `BlocksModel`: Blocks ORM

### Logic

* `BlockLogic`: Logic for creating, signing and persisting blocks
* `BlockRewardLogic`: Logic for calculating block rewards
* `BlockBytes`: Logic for converting blocks to / from byte buffers

### API

* `BlocksAPI`: API endpoints for querying the blockchain

### Constants

* `BlocksConstants`: Various constants necessary for verification / rewards

These Providers are exposed through a `CoreModule` which binds the Providers to an IoC Container

## Hooks

### Actions

* `OnPostApplyBlock`: Called after apply block before issuing database query
* `OnDestroyBlock`: Called after destroying block
* `OnTransactionSaved`: Called after transactions are persisted
* `OnReceiveBlock`: Called after receiving block from peer

### Filters

* `VerifyReceipt`: Filter when verifying receipt from peer
* `VerifyBlock`: Filter when verifying block
* `ApplyBlockDBOps`: Filter when apply block database operations
* `RollbackBlockDBOps`: Filter when rolling back block database operations

## API

The Blocks API enpoint can be found at `/api/blocks`. Review [the API Reference](https://risevision.github.io/#tag/Blocks-API) for more information.


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

