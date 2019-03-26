import { SendTransaction, TXSymbols } from '@risevision/core-transactions';
import {
  DBOp,
  IAccountsModel,
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

  public assetBytes(tx: IBaseTransaction<void>): Buffer {
    return Buffer.alloc(0);
  }

  public calculateMinFee(
    tx: IBaseTransaction<void>,
    sender: IAccountsModel,
    height: number
  ): bigint {
    return this.systemModule.getFees(height).fees.send;
  }

  public async verify(
    tx: IBaseTransaction<void>,
    sender: IAccountsModel
  ): Promise<void> {
    await super.verify(tx, sender);
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

  public async attachAssets(txs: Array<IBaseTransaction<void>>): Promise<void> {
    txs.forEach((t) => (t.asset = null));
  }
}
