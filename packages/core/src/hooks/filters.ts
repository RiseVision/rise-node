import { IAccountsModel } from '@risevision/core-interfaces';
import { createFilterDecorator as createFilter } from '@risevision/core-utils';
import { SignedBlockType } from '@risevision/core-types';

/**
 * Filter to modify the number of blocks to verify in snapshot verification mode.
 */
export const SnapshotBlocksCountFilter = createFilter<
  (bc: number) => Promise<number>
>('core/loader/snapshot/blocksCount');

/**
 * Called when verifying a block a submodule could either add its error or bypass other errors.
 */
export const VerifyBlockFilter = createFilter<
  (
    p: { errors: string[]; verified: boolean },
    block: SignedBlockType,
    lastBlock?: SignedBlockType
  ) => Promise<{ errors: string[]; verified: boolean }>
>('core/blocks/verify/verifyBlock');
export const VerifyBlockReceipt = createFilter<
  (
    p: { errors: string[]; verified: boolean },
    block: SignedBlockType,
    lastBlock?: SignedBlockType
  ) => Promise<{ errors: string[]; verified: boolean }>
>('core/blocks/verify/verifyReceipt');

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
