import { IAccountsModel } from '@risevision/core-interfaces';
import { createFilterDecorator as createFilter } from '@risevision/core-helpers';

/**
 * Filter to modify the number of blocks to verify in snapshot verification mode.
 */
export const SnapshotBlocksCountFilter = createFilter<(bc: number) => Promise<number>>('core/loader/snapshot/blocksCount');

/**
 * Filter to modify output of accounts API
 */
export const AccountApisGetAccount = createFilter<(accData: any, model?: IAccountsModel) => Promise<any>>('core/apis/accounts/account');
