import { DBOp, IAccountsModel, IBaseTransaction } from '@risevision/core-types';
import { createActionDecorator } from '@risevision/core-utils';
import { KeyStoreAsset } from '../transaction';

/**
 * This Action can be used to throw an error (reject a promise) in case the tx is not valid for some specific usecase.
 * Ex: for the "preferred-fruit" key you would like to allow only values that refer to a fruit such as "banana" etc.
 * Ex2: key: "btc-address" value -> only a valid btc address.
 */
export const VerifyKeystoreTx = createActionDecorator<
  (
    tx: IBaseTransaction<KeyStoreAsset, bigint>,
    sender?: IAccountsModel
  ) => Promise<Array<DBOp<any>>>
>('core-keystore/txlogic/verify');
