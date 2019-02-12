# RISE Node Core: Utils

Various utilities for RISE node core modules

## Overview

The Utils package makes available an assortment of useful utilities for common operations shared among modules such as http errors, decorators, loggers and more

## Schema

The Utils package provides access to a schema validator used mostly by APIs and the transport layer. Modules may choose to define schemas in the `MODULE_DIR/schema` directory, and validate incoming request using [`z_schema` schema validator](https://github.com/zaggino/z-schema)


