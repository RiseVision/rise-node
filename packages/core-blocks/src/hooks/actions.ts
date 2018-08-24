// ### Chain module hooks
import { IBlocksModel } from '@risevision/core-interfaces';
import { createActionDecorator as createAction } from '@risevision/core-utils';
import { Transaction } from 'sequelize';
import { IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';

/**
 * Called Before core module starts issuing any database query.
 * You can interrupt the block apply process by throwing or rejecting a promise.
 */
export const OnPreApplyBlock  = createAction<(block: IBlocksModel, tx?: Transaction) => Promise<void>>('core/blocks/chain/applyBlock.pre');
export const OnPostApplyBlock = createAction<(block: IBlocksModel, tx?: Transaction) => Promise<void>>('core/blocks/chain/applyBlock.post');
/**
 * Called After core module has performed all its operation about destroying a block.
 * You can interrupt the process by throwing or rejecting
 */
export const OnDestroyBlock   = createAction<(block: IBlocksModel, tx?: Transaction) => Promise<void>>('core/blocks/chain/onDestroyBlock');

/**
 * Called after transactions are persisted in the database
 */
export const OnTransactionsSaved = createAction<(txs: Array<IConfirmedTransaction<any>>, block?: SignedBlockType) => Promise<void>>('core-blocks/onTransactionsSaved');
