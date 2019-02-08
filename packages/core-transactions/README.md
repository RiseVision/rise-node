# RISE Node Core: Transactions Module

The transaction module provides the core logic surrounding transactions in the RISE network

## Overview

Transactions on the RISE network have to go through a procedure to be included within the blockchain. First the client must submit the transaction to a node through the Transaction API. After this has been achieved, the node must save the transaction in a pool of unconfirmed transactions and propagate the transaction to other nodes on the network. Nodes must receive, validate and eventually include the transaction in a signed block and add it to the blockchain through the Blocks module. This module provides the logic to perform all of these functions

### Base Transaction

The Transaction module provides the definition of a Base Transaction class which other modules may use to create a "Special Transaction" (like a `VoteTransaction` by the Consensus module). `BaseTx` must be extended by the special transactions and filled in with the appropriate logic

* `Transaction.caclulateMinFee`: Get the minimum fee for submitting the transaction
* `Transaction.assetBytes`: Get the raw asset Buffer from a transaction
* `Transaction.readAssetFromBytes`: Get asset as an object from a Buffer
* `Transaction.verify`: Verify the Transaction
* `Transaction.findConflicts`: Find conflicts with other included Transactions in a Block
* `Transaction.apply`: Apply transaction side effects after confirmation
* `Transaction.undo`: Rollback transactions side effects of confirmed transaction
* `Transaction.applyUnconfirmed`: Apply transaction side effects before confirmation
* `Transaction.undoUnconfirmed`: Rollback transaction side effects of an unconfirmed transaction
* `Transaction.objectNormalize`: Convert transaction to a JavaScript Object
* `Transaction.dbSave`: Save the Transaction assets to the database
* `Transaction.attachAssets`: Retrieve the Transaction assets from the database
* `Transaction.getMaxBytesSize`: Get the maximum size of the Transaction type

## Providers

* `TransactionsAPI`: Transaction API endpoints
* `SendTransaction`: Send RISE Transaction
* `TransactionsModel`: Transaction ORM
* `SendTxAssetModel`: Asset ORM for a Send Transaction
* `TransactionsModule`: Service for processing and querying transactions
* `TransactionLogic`: Logic for verifying, applying and rolling back transactions
* `TransactionPool`: Unconfirmed transaction queue
* `PoolManager`: Logic to manage Transaction Pool
* `TXBytes`: Encoding / decoding transaction buffer logic

## Hooks

### Actions

* `TxLogicStaticCheck`: Action before basic transaction validation assertions
* `TxLogicVerify`: Action before transaction verification
* `OnNewUnconfirmedTransaction`: Action on incoming unconfirmed transaction

### Filters

Allows other modules to modify the transaction verification and application flow. Useful for second signature / multisignature transactions.

* `TxApplyFilter`: Called to modify transaction application
* `TxApplyUnconfirmedFilter`: Called to modify unconfirmed transaction application
* `TxUndoFilter`: Called to modify transaction rollback
* `TxUndoUnconfirmedFilter`: Called to modify unconfirmed transaction rollback
* `SendTxApplyFilter`: Called to modify send transaction application
* `SendTxUndoFilter`: Called to modify send transaction rollback
* `TxReadFilter`: Called to allow modification of transaction readiness state
* `TXApiGetTxFilter`: Called to allow modification of transaction API get response for a transaction
* `TxExpireTimeout`: Called to determine the timeout of a transaction

## API

The Transaction API endpoint can be found at `/api/transactions`. Review [the API Reference](https://risevision.github.io/#tag/Transactions-API) for more information.

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

