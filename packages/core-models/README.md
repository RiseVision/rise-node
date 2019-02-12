# RISE Node Core: Models Module

Defines RISE node database object module interfaces.

## Overview

Modules can define database objects to persist data useful to operations to a database, in order to query or keep track of state. The Models Module defines a consistent interface for dealing with these objects, provides a model lifecycle, as well as wraps objects in an ORM through [sequelize](http://docs.sequelizejs.com/). This module in addition establishes a connection to the PostgreSQL database.

### Lifecycle

* Looks for a `MODULE_DIR/sql/schema.sql` file to initialize a schema for the ORM
* `module.onPreInitModules`: called before initializing models
* `module.onPostInitModules`: called after initializing models

## Interfaces

* `BaseModel`: Base model to extend for module models


