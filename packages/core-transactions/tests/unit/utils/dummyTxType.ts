import {
  DBOp,
  IAccountsModel,
  IBaseTransaction,
} from '../../../../core-types/src';
import { BaseTx } from '../../../src';

export class DummyTxType extends BaseTx<void, any> {
  public calculateMinFee(
    tx: IBaseTransaction<void>,
    sender: IAccountsModel,
    height: number
  ): bigint {
    return 0n;
  }

  public dbSave(
    tx: IBaseTransaction<void> & { senderId: string },
    blockId?: string,
    height?: number
  ): DBOp<any> {
    return undefined;
  }

  public objectNormalize(
    tx: IBaseTransaction<void, bigint>
  ): IBaseTransaction<void, bigint> {
    return undefined;
  }
}
