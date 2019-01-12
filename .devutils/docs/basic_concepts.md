# Basic concepts

Rise V2 is built using the following concepts:
 - modularity,
 - IoC & DI,
 - extensibility, 
 - flexibility,
 - performances,
 - maintainability and exceptions,
 - a hooking system. 

## Modules

Instead of building a [monolithic application](https://en.wikipedia.org/wiki/Monolithic_application), RISE v2 embraces a modular approach where the core logic is split in different submodules each of which is responsible for a specific feature or functionality.

## IoC & DI

IoC (Inversion Of Control) and DI (Dependency Injection) are 2 a very popular design principle in software arcitecture. When writing the core modules we made sure that any inner dependency was injected to the consumer. This allows developers to extend, overwrite, change the behavior/implementation even of the smallest thing whilst maintaining the code readable and usable.

## Extensibility

Thanks to the new modular approach, a newly built blockchain app could drastically diverge from RISE consensus and implement their own. For example creating a `PoW` crypto project will just require the creator to write a `PoW` module whilst benefitting the rest of modules.

## Flexibility

Modules have both config and constants that can drastically change their behavior. 

## Performances

Modules are written to use native datatypes such as Buffers or [BigInt](https://developers.google.com/web/updates/2018/05/bigint) to allow a much more efficient processing then using human readable data-formats.

## Maintainability and exceptions

Maintaining a blockchain is no easy task. When there's a bug the code maintainer is required to fix it. Unfortunately that is not always as "easy" as it might sound since bugs often leave a mark in the blockchain.

A **proper** blockchain project is required to be trustless so that a new node operator should be able to sync from genesis anytime. This means that the code maintainer needs to allow for the bug to still happen by adding some technology debt to the codebase.

For this reason we created an easy way to allow developers to define their `Exceptions` which will allow them to leave their fixed code untouched. 

## Hooking System

RISE v2 modules can both declare their own hooks or use other modules hooks. Similar to [WordPress hooking system](https://premium.wpmudev.org/blog/understanding-using-wordpress-hooks/), RISE v2 enbraces both concepts:
 
 - Actions
 - Filters 

An `Action` hook is a `fire and forget` like method useful to perform extra operations when an event occurs. For example, a caching module might want to do some invalidation when a new block is successfully applied.

A `Filter` hook is a `changing behavior` mechanism. For example: a filter could be used to add/change/remove SQL statements to be issued to the database right after the blocks is applied.


