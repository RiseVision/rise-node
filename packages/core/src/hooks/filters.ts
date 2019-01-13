import { IAccountsModel } from '@risevision/core-interfaces';
import { SignedBlockType } from '@risevision/core-types';
import { createFilterDecorator as createFilter } from '@risevision/core-utils';

/**
 * Filter to modify the number of blocks to verify in snapshot verification mode.
 */
export const SnapshotBlocksCountFilter = createFilter<
  (bc: number) => Promise<number>
>('core/loader/snapshot/blocksCount');

/**
 * Called when verifying a block a submodule could either add its error or bypass other errors.
 */

/**
 * Called when there is a need to calculate the idSequence for block comparison against another peer
 */
export const UtilsCommonHeightList = createFilter<
  (heights: number[], height: number) => Promise<number[]>
>('core/blocks/utils/commonHeightList');

/**
 * Called from loader module to decide what to sync
 */
export const WhatToSync = createFilter<(what: string[]) => Promise<string[]>>(
  'core/loader/whatToSync'
);
