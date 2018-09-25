import { Symbols } from '@risevision/core-interfaces';
import { SendTxApplyFilter, SendTxUndoFilter, TxApplyFilter, TxUndoFilter } from '@risevision/core-transactions';
import { address, DBCustomOp, DBOp, IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';
import { MyBigNumb } from '@risevision/core-utils';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { dPoSSymbols, Slots } from '../../helpers';
import { RoundsLogic } from '../../logic/rounds';
import { RoundsModel } from '../../models';
import { ModelSymbols } from '@risevision/core-models';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class Transactionshooks extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.rounds)
  private roundsModel: typeof RoundsModel;

  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;

  @inject(dPoSSymbols.logic.rounds)
  private slots: Slots;

  @TxApplyFilter()
  public async onTxApply(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<any>, block: SignedBlockType) {
    const totalAmount = new MyBigNumb(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.senderId, -totalAmount, block),
    ];
  }

  @TxUndoFilter()
  public async onTxUndo(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<any>, block: SignedBlockType) {
    const totalAmount = new MyBigNumb(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.senderId, totalAmount, block),
    ];
  }

  @SendTxApplyFilter()
  public async onSendTxApply(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<void>, block: SignedBlockType) {
    const totalAmount = new MyBigNumb(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.recipientId, totalAmount, block),
    ];
  }

  @SendTxUndoFilter()
  public async onSendTxUndo(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<void>, block: SignedBlockType) {
    const totalAmount = new MyBigNumb(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.recipientId, -totalAmount, block),
    ];
  }

  private calcOp(addr: address, amount: number, block: SignedBlockType): DBCustomOp<RoundsModel> {
    return {
      type : 'custom',
      model: this.roundsModel,
      query: this.roundsModel.insertMemRoundBalanceSQL({
        address: addr,
        amount,
        blockId: block.id,
        round  : this.roundsLogic.calcRound(block.height),
      }),
    };
  }
}
