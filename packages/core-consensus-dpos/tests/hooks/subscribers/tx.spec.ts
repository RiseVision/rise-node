import { createRandomTransaction, toBufferedTransaction } from '@risevision/core-transactions/tests/utils/txCrafter';
import { expect } from 'chai';
import { Container } from 'inversify';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { Transactionshooks } from '../../../src/hooks/subscribers';
import { dPoSSymbols } from '../../../src/helpers';
import { ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { TXSymbols } from '@risevision/core-transactions';
import { createFakeBlock } from '@risevision/core-blocks/tests/utils/createFakeBlocks';
import { AccountsModelForDPOS } from '../../../src/models';
import { ModelSymbols } from '@risevision/core-models';

describe('hooks/subscribers/tx', () => {
  let container: Container;
  let instance: Transactionshooks;
  let txLogic: ITransactionLogic;
  let AccountsModel: typeof AccountsModelForDPOS;
  let RoundsModel: any;
  before(async () => {
    container     = await createContainer(['core-consensus-dpos', 'core-transactions', 'core', 'core-helpers']);
    instance      = container.get(dPoSSymbols.hooksSubscribers.transactions);
    txLogic       = container.get(TXSymbols.logic);
    AccountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    RoundsModel   = container.getNamed(ModelSymbols.model, dPoSSymbols.models.rounds);
  });
  it('should add 2 memroundsql with proper data for tx apply', async () => {
    const tx    = toBufferedTransaction(createRandomTransaction());
    const block = createFakeBlock(container);
    const ops   = await txLogic.apply(
      { ...tx, blockId: block.id, senderId: tx.senderId },
      block,
      new AccountsModel({ address: tx.senderId, balance: 100000000, u_balance: 10000000 })
    );

    expect(ops[ops.length - 2].model).deep.eq(RoundsModel);
    expect((ops[ops.length - 2] as any).query).contains(`(${tx.amount + tx.fee})`);
    expect((ops[ops.length - 2] as any).query).contains(tx.recipientId);
    expect(ops[ops.length - 1].model).deep.eq(RoundsModel);
    expect((ops[ops.length - 1] as any).query).contains(`-${tx.amount + tx.fee}`);
    expect((ops[ops.length - 1] as any).query).contains(tx.senderId);
  });
  it('should add 2 memroundsql with proper data for tx undo', async () => {
    const tx    = toBufferedTransaction(createRandomTransaction());
    const block = createFakeBlock(container);
    const ops   = await txLogic.undo(
      { ...tx, blockId: block.id, senderId: tx.senderId },
      block,
      new AccountsModel({ address: tx.senderId, balance: 100000000, u_balance: 10000000 })
    );

    expect(ops[ops.length - 2].model).deep.eq(RoundsModel);
    expect((ops[ops.length - 2] as any).query).contains(`(-${tx.amount + tx.fee})`);
    expect((ops[ops.length - 2] as any).query).contains(tx.recipientId);
    expect(ops[ops.length - 1].model).deep.eq(RoundsModel);
    expect((ops[ops.length - 1] as any).query).contains(`(${tx.amount + tx.fee})`);
    expect((ops[ops.length - 1] as any).query).contains(tx.senderId);
  });
});
