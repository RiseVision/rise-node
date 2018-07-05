import { BigNum, Symbols } from '@risevision/core-helpers';
import { SendTxApplyFilter, SendTxUndoFilter, TxApplyFilter, TxUndoFilter } from '@risevision/core-transactions';
import { address, DBCustomOp, DBOp, IConfirmedTransaction, SignedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { dPoSSymbols, Slots } from '../helpers';
import { RoundsLogic } from '../logic/rounds';
import { RoundsModel } from '../models';

@injectable()
export class Transactionshooks extends WPHooksSubscriber(Object) {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(dPoSSymbols.models.rounds)
  private roundsModel: typeof RoundsModel;

  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;

  @inject(dPoSSymbols.logic.rounds)
  private slots: Slots;

  @TxApplyFilter()
  public async onTxApply(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<any>, block: SignedBlockType) {
    const totalAmount = new BigNum(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.senderId, -totalAmount, block),
    ];
  }

  @TxUndoFilter()
  public async onTxUndo(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<any>, block: SignedBlockType) {
    const totalAmount = new BigNum(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.senderId, totalAmount, block),
    ];
  }

  @SendTxApplyFilter()
  public async onSendTxApply(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<void>, block: SignedBlockType) {
    const totalAmount = new BigNum(tx.amount.toString()).plus(tx.fee).toNumber();
    return [
      ...ops,
      this.calcOp(tx.recipientId, totalAmount, block),
    ];
  }

  @SendTxUndoFilter()
  public async onSendTxUndo(ops: Array<DBOp<any>>, tx: IConfirmedTransaction<void>, block: SignedBlockType) {
    const totalAmount = new BigNum(tx.amount.toString()).plus(tx.fee).toNumber();
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
