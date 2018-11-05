import { IAccountsModel } from '@risevision/core-interfaces';
import { IBaseTransaction } from '@risevision/core-types';
import { createActionDecorator as createAction } from '@risevision/core-utils';

export const TxLogicStaticCheck = createAction<
  (
    tx: IBaseTransaction<any>,
    sender?: IAccountsModel,
    requester?: IAccountsModel,
    height?: number
  ) => Promise<void>
>('core-transactions/txlogic/verify/static-checks');

export const TxLogicVerify = createAction<
  (
    tx: IBaseTransaction<any>,
    sender?: IAccountsModel,
    requester?: IAccountsModel,
    height?: number
  ) => Promise<void>
>('core-transactions/txlogic/verify/tx');

export const OnNewUnconfirmedTransation = createAction<
  (tx: IBaseTransaction<any>, broadcast?: boolean) => Promise<void>
>('core-transactions/pool/onUnconfirmedTx');
