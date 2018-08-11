import { IAccountsModel } from '../../../core-interfaces/src/models';
import { DBOp, IBaseTransaction } from '../../../core-types/src';
import { BaseTx } from '../../src';

export class DummyTxType extends BaseTx<void, any> {
  public calculateFee(tx: IBaseTransaction<void>, sender: IAccountsModel, height: number): number {
    return 0;
  }

  public dbSave(tx: IBaseTransaction<void> & { senderId: string }, blockId?: string, height?: number): DBOp<any> {
    return undefined;
  }

  public objectNormalize(tx: IBaseTransaction<void>): IBaseTransaction<void> {
    return undefined;
  }

}
