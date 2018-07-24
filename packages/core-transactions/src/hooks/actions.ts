import { createActionDecorator as createAction } from '@risevision/core-utils';
import { IAccountsModel } from '@risevision/core-interfaces';
import { DBOp, IBaseTransaction, IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';

export const TxLogicStaticCheck = createAction<(tx: IBaseTransaction<any>, sender?: IAccountsModel, requester?: IAccountsModel, height?: number) => Promise<void>>
  ('core-transactions/txlogic/verify/static-checks');

export const TxLogicVerify = createAction<(tx: IBaseTransaction<any>, sender?: IAccountsModel, requester?: IAccountsModel, height?: number) => Promise<void>>
  ('core-transactions/txlogic/verify/tx');
