import { IAccountsModel } from '@risevision/core-interfaces';
import {
  DBOp,
  IBaseTransaction,
  IConfirmedTransaction,
  ITransportTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { createFilterDecorator } from '@risevision/core-utils';

/**
 * Decorator for tx-apply filter. Called when calculating every tx operations.
 */
export const TxApplyFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/txlogic/apply/ops');

export const TxApplyUnconfirmedFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/txlogic/applyUnconfirmed/ops');

export const TxUndoFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/txlogic/undo/ops');

export const TxUndoUnconfirmedFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/txlogic/uncoUnconfirmed/ops');

export const SendTxApplyFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/send-tx/apply/ops');

export const SendTxUndoFilter = createFilterDecorator<
  (
    ops: Array<DBOp<any>>,
    tx?: IConfirmedTransaction<any>,
    block?: SignedBlockType,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-transactions/send-tx/undo/ops');

/**
 * Called to allow hooks modify the readyness of a transaction
 */
export const TxReadyFilter = createFilterDecorator<
  (
    ready: boolean,
    tx?: IBaseTransaction<any>,
    sender?: IAccountsModel
  ) => Promise<boolean>
>('core-transactions/tx/ready');

/**
 * Called to allow extra modification of API response for a single transaction
 */
export const TXApiGetTxFilter = createFilterDecorator<
  (tx: ITransportTransaction<any>) => Promise<ITransportTransaction<any>>
>('core-transactions/api/get-tx');

/**
 * Called to determine the timeout allowed for such transaction before expiring
 */
export const TxExpireTimeout = createFilterDecorator<
  (timeout: number, tx: IBaseTransaction<any>) => Promise<number>
>('core-transactions/tx-expire-timeout');
