import { IBlocksModel } from '@risevision/core-interfaces';
import { BaseModel } from '@risevision/core-models';
import {
  ActionFilterDecoratorType,
  createActionDecorator as createAction,
} from '@risevision/core-utils';
import { Container } from 'inversify';
import { Transaction } from 'sequelize';

// ### LOADER Module hooks ####

export const OnBlockchainReady = createAction('core/loader/onBlockchainReady');
export const OnSyncRequested = createAction<(what: string) => Promise<void>>(
  'core/loader/onSyncRequested'
);
/**
 * Any DataStore integrity check needs to be performed here. Reject to let the core reload the blockchain from genesis
 */
export const OnCheckIntegrity = createAction<
  (totalBlocks: number) => Promise<void>
>('core/loader/loadBlockchain/checkIntegrity');

/**
 * Modules that store values that are unconfirmed will need to reset their unconfirmed entries with the confirmed values
 * so that unconfirmed values are equal to the confirmed ones.
 */
export const RestoreUnconfirmedEntries = createAction(
  'core/loader/accounts/restoreUnconfirmedEntries'
);

/**
 * Called when blockchain is loading from zero. Either because of snapshot verification or some other
 * integrity issue.
 * Modules hooking to this will require to remove any account associated datastore to have a clean start.
 */
export const RecreateAccountsTables = createAction(
  'core/loader/load/recreateAccountsDatastores'
);

// ### INIT (AppManager) hooks
/**
 * Called after container has been initialized with core elements.
 * Use it to register your own components to the container or to rebind some of the default registered
 * elements.
 */
export const InitContainer = createAction<
  (container: Container) => Promise<Container>
>('core/init/container');

/**
 * Called after container has been initialized and models registered.
 * Plugins could use this to monkey patch a model. Ex: adding fields or modifying scopes.
 */
export const InitModel = createAction<
  (model: typeof BaseModel) => Promise<Container>
>('core/init/model');

// ## Account Logic Hooks
