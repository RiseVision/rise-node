# RISE Node Core: Helpers Module

Various helpers for asynchronous process management and global App state management

## Overview

The Helpers Module initialize various classes and objects used to coordinate App side effects. The helper module initializes and exposes a logger, job queues (used to schedule asynchronous jobs), sequences (used to serialize asynchronous jobs), a schema validator (used to validated JavaScript Objects), and an App State object.

### Schema

The Helpers module provides access to a schema validator used mostly by APIs and the transport layer. Modules may choose to define schemas in the `MODULE_DIR/schema` directory, and validate incoming request using [`z_schema` schema validator](https://github.com/zaggino/z-schema)

## Providers

* `AppState`: Key value store for application side effect management
* `JobsQueue`: A simple asynchronous job scheduler
* `logger`: Logger
* `zschema`: Schema validator
* `balancesSequence`: FIFO job sequence for balance related functions
* `dbSequence`: FIFO job sequence for DB related functions
* `defaultSequence`: FIFO job sequence for general functions
