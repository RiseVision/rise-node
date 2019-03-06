import { IAccountsModel, IBaseTransaction } from '@risevision/core-types';
import {
  ActionFilterDecoratorType,
  createActionDecorator as createAction,
} from '@risevision/core-utils';

export const TxLogicStaticCheck = createAction<
  (
    tx: IBaseTransaction<any, bigint>,
    sender?: IAccountsModel,
    height?: number
  ) => Promise<void>
>('core-transactions/txlogic/verify/static-checks');

export const TxLogicVerify = createAction<
  (
    tx: IBaseTransaction<any, bigint>,
    sender?: IAccountsModel,
    height?: number
  ) => Promise<void>
>('core-transactions/txlogic/verify/tx');

export const TxSignatureVerify = createAction<
  (
    tx: IBaseTransaction<any, bigint>,
    hash: Buffer,
    sender?: IAccountsModel,
    height?: number
  ) => Promise<void>
>('core-transactions/txlogic/verify/tx');

export const OnNewUnconfirmedTransation = createAction<
  (tx: IBaseTransaction<any, bigint>, broadcast?: boolean) => Promise<void>
>('core-transactions/pool/onUnconfirmedTx');
