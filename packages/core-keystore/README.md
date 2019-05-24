# RISE Node Core: Keystore

This RISE keystore module provides all functionalities to allow blockchain accounts to store permanent data in the form of a key-store db.

## Overview

The Module is pretty simple and it only contains the very basic classes and utilities needed to perform such functionality.

## Hook Actions

* `VerifyKeystoreTx`: Issued to verify the tx from the main module (or another module). Ex a module could ensure the value of a key is using a specific data format.


