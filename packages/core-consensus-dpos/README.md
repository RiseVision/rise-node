# RISE Node Core: DPoS Consensus Module

The Blocks Module defines the database tables, logic and API endpoints for working with RISE Delegates and forging

## Overview

This Module provides some important functionality for calculating rounds and querying the current delegates list, which are the crucial building pieces to the RISE consensus algorithm and new block creation.

## Providers

### Modules

* `DelegatesModule`: Service Provider for getting a list of delegates
* `ForgeModule`: Service Provider for forging new blocks
* `RoundsModule`: Service Provider for calculating rounds and ticks

### API

* `AccountsAPI`: API for delegate accounts
* `DelegatesAPI`: API for querying delegates, votes and forging status

### Logic

* `RoundLogic`: Logic for applying rounds and votes
* `RoundsLogic`: Logic for calculating slots

### Transactions

* `RegisterDelegateTransaction`: Register Delegate Transaction interface, creation and verification
* `VoteTransaction`: Vote Transaction interface, creation and verification

### Models

* `Accounts2DelegatesModel`: Joins Accounts and Delegates
* `Accounts2U_DelegatesModel`: Joins Accounts and Unconfirmed Delegates
* `DelegatesModel`: Delegate ORM
* `DelegatesRoundModel`: Forging Round ORM
* `RoundFeesModel`: Round Fees ORM
* `VotesModel`: Votes ORM

### Helpers

* `Slots`: Round slot timing helpers
* `DposV2Helper`: Checks consensus version for backwards compatibility
* `RoundChanges`: Helpers to calculate fees / rewards for rounds

### Constants

* `Constants`: Necessary constants for calculating rounds and verifying vote transactions

## API

The Delegates API endpoint can be found at `/api/delegates`, although this module adds some extra endpoints to the Accounts API as well. Review [the API Reference](https://risevision.github.io/#tag/Delegates-API) for more information.



