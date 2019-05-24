import { DBOp, IAccountsModel, IBaseTransaction } from '@risevision/core-types';
import { createActionDecorator } from '@risevision/core-utils';
import { KeyStoreAsset } from '../transaction';

export const VerifyKeystoreTx = createActionDecorator<
  (
    tx: IBaseTransaction<KeyStoreAsset, bigint>,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-keystore/txlogic/verify');
