import { createFilterDecorator as createFilter } from '@risevision/core-helpers';
import { BaseModel } from '@risevision/core-models';

/**
 * Filter to modify the number of blocks to verify in snapshot verification mode.
 */
export const SnapshotBlocksCountFilter = createFilter<(bc: number) => Promise<number>>('core/loader/snapshot/blocksCount');

