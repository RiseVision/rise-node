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

The Blocks API endpoint can be found at `/api/blocks`. Review [the API Reference](https://risevision.github.io/#tag/Blocks-API) for more information.



