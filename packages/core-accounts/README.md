# RISE Node Core: Accounts Module

The Accounts Module defines the database tables, logic and API endpoints for working with RISE accounts.

## Overview

Although much of the logic for accounts are done on the front end through Key Pair logic, RISE nodes need to keep track of Accounts with usernames for governance and accountability. In addition, the Accounts module provides endpoints to analyze transactions and balances on a RISE account level.

## Providers

The Accounts Module provides the following Providers exposed in the `CoreModule`:

- `AccountLogic`: Account update / retrieval abstractions
- `AccountsModel`: Accounts ORM
* `AccountsModule`: Accounts service for dealing with accessing and updating accounts
* `AccountsAPI`: API Endpoints for querying and updating Accounts

## Filter Hooks

The Account module also exposes a `FilterAPIGetAccount` filter hook, to modify an account retrieved by the API in another module. See [`core-utils`](../core-utils/README.md) for how to use.

## API

The Accounts API endpoint can be found at `/api/accounts`. Review [the API Reference](https://risevision.github.io/#tag/Accounts-API) for more information.


