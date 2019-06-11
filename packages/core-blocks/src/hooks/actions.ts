// ### Chain module hooks
import {
  IBaseTransaction,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import { createActionDecorator as createAction } from '@risevision/core-utils';
import { Transaction } from 'sequelize';

/**
 * Called Before core module starts issuing any database query.
 * You can interrupt the block apply process by throwing or rejecting a promise.
 */
export const OnPostApplyBlock = createAction<
  (
    block: SignedAndChainedBlockType,
    tx?: Transaction,
    broadcast?: boolean
  ) => Promise<void>
>('core/blocks/chain/applyBlock.post');

/**
 * Called when block has been succesffully applied. throwing an error here wont cause the block to be rolled back!
 * Use this method to update application data.
 */
export const OnBlockApplied = createAction<
  (block: SignedAndChainedBlockType, broadcast?: boolean) => Promise<void>
>('core/blocks/chain/blockApplied');
/**
 * Called After core module has performed all its operation about destroying a block.
 * You can interrupt the process by throwing or rejecting
 * @codesample actionHook
 */
export const OnDestroyBlock = createAction<
  (
    destroyedBlock: SignedAndChainedBlockType,
    newLastBlock: SignedAndChainedBlockType,
    tx?: Transaction
  ) => Promise<void>
>('core/blocks/chain/onDestroyBlock');

/**
 * Called after transactions are persisted in the database
 */
export const OnTransactionsSaved = createAction<
  (txs: Array<IBaseTransaction<any>>, block?: SignedBlockType) => Promise<void>
>('core-blocks/onTransactionsSaved');
