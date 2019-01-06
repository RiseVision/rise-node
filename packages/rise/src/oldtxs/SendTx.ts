import { IAccountsModel } from '@risevision/core-interfaces';
import { SendTransaction, TXSymbols } from '@risevision/core-transactions';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { OldBaseTx } from './BaseOldTx';

@injectable()
export class OldSendTx extends OldBaseTx<void, null> {
  @inject(TXSymbols.transaction)
  @named(TXSymbols.sendTX)
  private sendTX: SendTransaction;

  public calculateMinFee(
    tx: IBaseTransaction<void>,
    sender: IAccountsModel,
    height: number
  ): bigint {
    return this.systemModule.getFees(height).fees.send;
  }

  public verify(
    tx: IBaseTransaction<void>,
    sender: IAccountsModel
  ): Promise<void> {
    return this.sendTX.verify(tx as any, sender);
  }

  public apply(
    tx: IBaseTransaction<void>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return this.sendTX.apply(tx as any, block, sender);
  }

  public undo(
    tx: IBaseTransaction<void>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return this.sendTX.undo(tx as any, block, sender);
  }

  public dbSave(): DBOp<null> {
    return null;
  }
}
