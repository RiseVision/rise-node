# RISE Node Core: System Module

The RISE core System module provides an assortment of System wide monitoring and management services

## Overview

The System Module provides three main functions. First, the module allows for access to system information in order to return information about the node to API requests, as well as other peers. Second, the Loader Module and API provides the logic for syncing the blockchain as well as information about the current sync status of the node. Lastly, the module contains the logic to perform sequel migrations on the database.

## Providers

* `TimeToEpoch`: Logic to calculate current time in terms of time since the network start date or Epoch
* `ForkModule`: Service to insert and broadcast stats about a blockchain fork
* `SystemModule`: Service to get information about the node and network
* `LoaderModule`: Service to sync blockchain
* `LoaderAPI`: Loader API endpoints
* `MigrationsModel`: Migration Tool ORM
* `Migrator`: Migration Tool

## Hooks

### Actions

* `OnBlockchainReady`: Action when Blockchain is fully synced and ready
* `OnSyncRequested`: Action when Blockchain sync is requested
* `OnCheckIntegrity`: Action when datastore check integrity is performed
* `RestoreUnconfirmedEntries`: Action when unconfirmed values need to match confirmed ones
* `RecreateAccountsTables`: Action when blockchain is loading from start
* `InitContainer`: Called after container has been initialized
* `InitModel`: Called after models have been registered and initialized

### Filters

* `SnapshotBlocksCountFilter`: Filter to modify the number of blocks to verify in snapshot verification mode
* `UtilsCommonHeightList`: Filter for when block id sequence is recalculated against another peer
* `WhatToSync`: Filter for loader to decide what to sync

## API

The Loader API endpoint can be found at `/api/loader/status`. Review [the API Reference](https://risevision.github.io/#tag/Loader-API) for more information.


