import { IAccountsModel, SignedBlockType } from '@risevision/core-types';
import {
  ActionFilterDecoratorType,
  createFilterDecorator as createFilter,
} from '@risevision/core-utils';

/**
 * Filter to modify the number of blocks to verify in snapshot verification mode.
 */
export const SnapshotBlocksCountFilter = createFilter<
  (bc: number) => Promise<number>
>('core/loader/snapshot/blocksCount');

/**
 * Called from loader module to decide what to sync
 */
export const WhatToSync = createFilter<(what: string[]) => Promise<string[]>>(
  'core/loader/whatToSync'
);
