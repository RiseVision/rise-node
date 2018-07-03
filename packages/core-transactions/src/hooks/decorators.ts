import { createFilterDecorator } from '@risevision/core-helpers';
import { IAccountsModel } from '@risevision/core-interfaces';
import { DBOp, IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';
import { IWPHookSubscriber, OnWPAction, OnWPFilter, WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
//
// export type hookDecoratorType<K> =
//   <T extends IWPHookSubscriber>(target: T,
//                                 method: string,
//                                 descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K>;
//
// // tslint:disable-next-line max-line-length
// export const createFilterDecorator = <K>(filter: string): (hookGetter: () => WordPressHookSystem, priority?: number) => hookDecoratorType<K> => {
//   return <T extends IWPHookSubscriber>(hookGetter: () => WordPressHookSystem, priority?: number) => {
//     return OnWPFilter<T>(hookGetter, filter, priority) as any;
//   };
// };
//
// // tslint:disable-next-line max-line-length
// export const createActionDecorator = <K>(filter: string): (hookGetter: () => WordPressHookSystem, priority?: number) => hookDecoratorType<K> => {
//   return <T extends IWPHookSubscriber>(hookGetter: () => WordPressHookSystem, priority?: number) => {
//     return OnWPAction<T>(hookGetter, filter, priority) as any;
//   };
// };

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
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('apply_send_tx_ops');

export const SendTxUndoFilter = createFilterDecorator<(
  ops: Array<DBOp<any>>,
  tx?: IConfirmedTransaction<any>,
  block?: SignedBlockType,
  sender?: IAccountsModel) => Promise<Array<DBOp<any>>>>('undo_send_tx_ops');

