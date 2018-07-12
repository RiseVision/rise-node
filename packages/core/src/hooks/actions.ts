import { createActionDecorator as createAction } from '@risevision/core-helpers';
import { IBlocksModel } from '@risevision/core-interfaces';
import { BaseModel } from '@risevision/core-models';
import { Container } from 'inversify';
import { Transaction } from 'sequelize';

// ### LOADER Module hooks ####

export const OnBlockchainReady = createAction('core/loader/onBlockchainReady');
export const OnSyncStarted     = createAction('core/loader/onSync.started');
export const OnSyncFinished    = createAction('core/loader/onSync.finished');
export const OnCheckIntegrity    = createAction<(totalBlocks: number) => Promise<void>>('core/loader/loadBlockchain/checkIntegrity');

/**
 * Modules that store values that are unconfirmed will need to reset their unconfirmed entries with the confirmed values
 * so that unconfirmed values are equal to the confirmed ones.
 */
export const RestoreUnconfirmedEntries = createAction('core/loader/accounts/restoreUnconfirmedEntries');

/**
 * Any DataStore integrity check needs to be performed here. Reject to let the core reload the blockchain from genesis
 */
export const PerformIntegrityChecks = createAction('core/loader/performIntegrityChecks');

/**
 * Called when blockchain is loading from zero. Either because of snapshot verification or some other
 * integrity issue.
 * Modules hooking to this will require to remove any account associated datastore to have a clean start.
 */
export const RecreateAccountsTables = createAction('core/loader/load/recreateAccountsDatastores');

// ### INIT (AppManager) hooks
/**
 * Called after container has been initialized with core elements.
 * Use it to register your own components to the container or to rebind some of the default registered
 * elements.
 */
export const InitContainer = createAction<(container: Container) => Promise<Container>>('core/init/container');

/**
 * Called after container has been initialized and models registered.
 * Plugins could use this to monkey patch a model. Ex: adding fields or modifying scopes.
 */
export const InitModel = createAction<(model: typeof BaseModel) => Promise<Container>>('core/init/model');

// ### Chain module hooks
/**
 * Called Before core module starts issuing any database query.
 * You can interrupt the block apply process by throwing or rejecting a promise.
 */
export const PreApplyBlock = createAction<(block: IBlocksModel, tx?: Transaction) => Promise<void>>('core/blocks/chain/applyBlock.pre');
/**
 * Called After core module has performed all its operation about destroying a block.
 * You can interrupt the process by throwing or rejecting
 */
export const OnDestroyBlock = createAction<(block: IBlocksModel, tx?: Transaction) => Promise<void>>('core/blocks/chain/onDestroyBlock');


// ## Account Logic Hooks
