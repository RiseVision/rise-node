// ### Chain module hooks
import {
  IBaseTransaction,
  IBlocksModel,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import {
  ActionFilterDecoratorType,
  createActionDecorator as createAction,
} from '@risevision/core-utils';
import { Transaction } from 'sequelize';

/**
 * Called Before core module starts issuing any database query.
 * You can interrupt the block apply process by throwing or rejecting a promise.
 */
export const OnPostApplyBlock = createAction<
  (block: IBlocksModel, broadcast?: boolean) => Promise<void>
>('core/blocks/chain/applyBlock.post');

/**
 * Called After core module has performed all its operation about destroying a block.
 * You can interrupt the process by throwing or rejecting
 * @codesample actionHook
 */
export const OnDestroyBlock = createAction<
  (block: IBlocksModel, tx?: Transaction) => Promise<void>
>('core/blocks/chain/onDestroyBlock');

/**
 * Called after transactions are persisted in the database
 */
export const OnTransactionsSaved = createAction<
  (txs: Array<IBaseTransaction<any>>, block?: SignedBlockType) => Promise<void>
>('core-blocks/onTransactionsSaved');
