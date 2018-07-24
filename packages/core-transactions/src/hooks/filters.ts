import { createFilterDecorator } from '@risevision/core-utils';
import { IAccountsModel } from '@risevision/core-interfaces';
import { DBOp, IBaseTransaction, IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';

/**
 * Decorator for tx-apply filter. Called when calculating every tx operations.
 */
export const TxApplyFilter = createFilterDecorator<(
  ops: Array<DBOp<any>>,
  tx?: IConfirmedTransaction<any>,
  block?: SignedBlockType,
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('tx-apply');

export const TxUndoFilter = createFilterDecorator<(
  ops: Array<DBOp<any>>,
  tx?: IConfirmedTransaction<any>,
  block?: SignedBlockType,
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('tx-undo');

export const SendTxApplyFilter = createFilterDecorator<(
  ops: Array<DBOp<any>>,
  tx?: IConfirmedTransaction<any>,
  block?: SignedBlockType,
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('core-transactions/send-tx/apply/ops');

export const SendTxUndoFilter = createFilterDecorator<(
  ops: Array<DBOp<any>>,
  tx?: IConfirmedTransaction<any>,
  block?: SignedBlockType,
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('core-transactions/send-tx/undo/ops');

/**
 * Called to allow hooks modify the readyness of a transaction
 */
export const TxReadyFilter = createFilterDecorator<(ready: boolean, tx?: IBaseTransaction<any>, sender?: IAccountsModel) => Promise<boolean>>('core-transactions/tx/ready');
