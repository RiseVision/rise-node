# Core Module

## Introduction

A core module serves a specific usage, functionality or feature.
A core module should be as self-contained as possible.


## Anatomy of a core module

A RISE core module is a node module which also fullfills the following requirements:

1) Contains a specific subsection in the `package.json` file,
2) Exports a `CoreModule` instance (more on that in a few).

Package.json file needs to contain the following:

```json
{
  // ...
  "rise_vision": {
    "module": true
  },
  // ...
}

```

## Core module folder structure

The following showcases a typical suggested folder structure for a core module:

* `proto/`: contains all protobuf files for p2p communication
* `schema/`: contains all json schema files for data validation
* `sql/`: contains sql files
  * `migrations/`: contains all migrations files 
  * `schema.sql`: idempotent schema sql file for this module
* `src/`: contains js/ts source files for module logic
  * `p2p/`: p2p requests/response handlers
  * `models/`: Sequelize model files
  * `hooks/`: Everything about the exposed and used hooks
    * `filters.ts`: Exports all filters created by this module in form of usable [Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html).
    * `actions.ts`: Exports all actions created by this module in form of usable Decorators.
  * `index.ts`: Exports all the publicly available elements for third party usage.
  * `coremodule.ts`: Defines and exports an implementation of the `ICoreModule` interface defined in `core-launchpad` module.
    

## The Main module

The so called main module, `packages/rise` in rise repo, will need to declare its dependencies via package.json. Modules will be resolved by the `core-launchpad` module by traversing all packages.json of all requred dependencies. The collected modules are then sorted using a [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph) and [Topological Sorting](https://en.wikipedia.org/wiki/Topological_sorting).

The resulting order will be used extensively in the lifecycle of the whole app to determine which modules needs to be initialized (and teared down) before/after the the others.

## Lifecycle of RISE 

When RISE starts through the Launchpad module, it will:
 1. collect all the rise modules required for the current implementation to run by inspecting the Main module package.json 
 2. sort all the modules in descending order so that the first element has no other module dependency...
 3. parse CLI arguments
 4. Load config & genesisBlock
 5. Boot

When an uncaught exception occurs or user kills the process the launchpad module will attempt to gracefully teardown the whole app.


## Lifecycle of a Module

A module Lifecycle goes as follows

 1. `extendCommander()` method is called in case the module wants to add its own cli options
 2. `afterConfigValidation()` method is called with the current raw configuration object. This method could be used to case js native types to more complex data types such as Date or Buffer instances
 3. `addElementsToContainer()` is called to allow che module to manipulate the container by adding its own elements to it.
 4. `initAppElements()` is called to initialize some elements after container initialization.
 5. `preBoot()`
 6. `boot()`
 7. `teardown()`
 8. `postTeardown()`
 

Sometimes you need to do some stuff just before database models are initialized. To do so, a module developer could also provide an implementation for:

 - `onPreInitModels` 
 - `onPostInitModels`
 

**NOTE**: It's important to notice that module's methods are called for all rise modules by following the dependency ordering. Exception made for the tearing down process where the call order follows the reverse order.

  

