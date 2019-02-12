# RISE Node Core: Second Signature Module

The Second Signature Module provides endpoints for registration secondary key pairs with accounts

## Overview

Second signatures allow an extra layer of security for accounts. This module provides the endpoint to register a second signature with nodes, as well as the hooks for verifying transactions for accounts with second signatures after a second signature has been registered.

## Providers

* `SignaturesModel`: Transaction second signature ORM
* `AccountsModelWith2ndSign`: Account second signature ORM
* `SecondSignatureTransaction`: Transaction to register second signature
* `SignaturesAPI`: API endpoints to register and query second signature
* `SignHooksListener`: Transaction hooks to validate second signatures

## API

The Second Signature API endpoint can be found at `/api/signatures`. Review [the API Reference](https://risevision.github.io/#tag/Signatures-API) for more information.


