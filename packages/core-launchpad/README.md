# RISE Node Core: Launchpad

The RISE node launchpad module initializes the Application and starts / gracefully shuts down the node

## Overview

The Launchpad loads the submodules of the RISE node core and properly initializes them by providing a lifecycle for the submodules to initialize within. The `AppManager` allows submodules to add their exports to the inversion of control container so that other submodules may use their exports as dependencies within their own services through dependency injection. See [Inversify](http://inversify.io/) for more information on how this works. In addition, the module provides a binary to start the application through the command line, and a logging utility to monitor the node.

## Module Lifecycle

* `module.extendCommander`: add options to CLI
* `module.afterConfigValidation`: patch configuration of module with CLI parameters
* `module.addElementsToContainer`: add providers to container
* `module.initAppElements`: initialize service providers with dependencies
* `module.preBoot`: pre boot routine / initialization
* `module.boot`: boot module
* `module.teardown`: shutdown module
* `module.postTeardown`: cleanup module

## Interfaces

* `BaseCoreModule`: Base module to extend for modules

## Hook Actions

* `OnInitContainer`: After container has been initialized
* `OnFinishBoot`: After modules have been booted


