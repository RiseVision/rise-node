// ### Chain module hooks
import { IBlocksModel } from '@risevision/core-interfaces';
import { createActionDecorator as createAction } from '@risevision/core-utils';
import { Transaction } from 'sequelize';

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
