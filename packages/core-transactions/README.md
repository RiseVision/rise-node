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


