import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  createRandomAccountsWithFunds, createRandomAccountWithFunds, createRandomWallet,
  createRegDelegateTransaction, createSecondSignTransaction, createSendTransaction, createVoteTransaction,
  easyCreateMultiSignAccount, getRandomDelegateWallet
} from '../common/utils';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { BlocksModule } from '../../../src/modules';
import initializer from '../common/init';
import { Symbols } from '../../../src/ioc/symbols';
import { BlockType, SignedAndChainedBlockType } from '../../../src/logic';
import { BlocksModuleChain, BlocksModuleProcess } from '../../../src/modules/blocks/';
import * as supertest from 'supertest';
import { toBufferedTransaction } from '../../utils/txCrafter';
import { Slots } from '../../../src/helpers';
import { ISlots } from '../../../src/ioc/interfaces/helpers';
import { IAccountsModule, ITransactionsModule } from '../../../src/ioc/interfaces/modules';

chai.use(chaiAsPromised);

describe('forkProcessing', async () => {
  let blocksModule: BlocksModule;
  let blocksChainModule: BlocksModuleChain;
  let blocksProcessModule: BlocksModuleProcess;
  let slots: ISlots;
  let txModule: ITransactionsModule;
  let accModule: IAccountsModule;
  initializer.setup();
  beforeEach(() => {
    blocksModule        = initializer.appManager.container.get(Symbols.modules.blocks);
    blocksChainModule   = initializer.appManager.container.get(Symbols.modules.blocksSubModules.chain);
    blocksProcessModule = initializer.appManager.container.get(Symbols.modules.blocksSubModules.process);
    slots               = initializer.appManager.container.get<Slots>(Symbols.helpers.slots);
    txModule            = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
    accModule           = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts);
  });
  describe('mid-round', () => {
    initializer.autoRestoreEach();
    let initialBlock: SignedAndChainedBlockType;
    beforeEach(async () => {
      await initializer.rawMineBlocks(20);
      initialBlock = blocksModule.lastBlock;
    });
    describe('fork 5', () => {
      let first: SignedAndChainedBlockType;
      let second: SignedAndChainedBlockType;
      beforeEach(async () => {
        const tx = await createSendTransaction(0, 10, getRandomDelegateWallet(), createRandomWallet().address);
        const a  = await initializer.generateBlock([tx], slots.getSlotNumber());
        let b: SignedAndChainedBlockType;
        do {
          b = await initializer.generateBlock([
            await createSendTransaction(0, Math.ceil(Math.random() * 10000) + 1, getRandomDelegateWallet(), createRandomWallet().address)
          ], slots.getSlotNumber());
        } while (b.id > a.id);
        first  = a;
        second = b;
      });

      it('should properly remove old block and replace with new one', async () => {
        await blocksProcessModule.onReceiveBlock(first);
        expect(blocksModule.lastBlock.id).eq(first.id);
        await blocksProcessModule.onReceiveBlock(second);
        expect(blocksModule.lastBlock.id).eq(second.id);

        await expect(txModule.getByID(first.transactions[0].id)).rejectedWith('Transaction not found');
        await expect(txModule.getByID(second.transactions[0].id)).not.rejected;

        expect(await accModule.getAccount({address: '1R'})).not.null;
        const a = await accModule.getAccount({address: first.transactions[0].recipientId});
        expect(a.toPOJO().balance).deep.eq(0);
      });

      it('should not remove second if first comes later', async () => {
        await blocksProcessModule.onReceiveBlock(second);
        expect(blocksModule.lastBlock.id).eq(second.id);
        await blocksProcessModule.onReceiveBlock(first);
        expect(blocksModule.lastBlock.id).eq(second.id);

        await expect(txModule.getByID(first.transactions[0].id)).rejectedWith('Transaction not found');
        await expect(txModule.getByID(second.transactions[0].id)).not.rejected;

        expect(await accModule.getAccount({address: second.transactions[0].recipientId})).not.null;
        expect(await accModule.getAccount({address: first.transactions[0].recipientId})).to.be.undefined;
      });

      describe('second block with errors', async () => {
        it('tx with error', async () => {
          second.transactions[0].fee = -1;
          await blocksProcessModule.onReceiveBlock(first);
          expect(blocksModule.lastBlock.id).eq(first.id);
          try {
            await blocksProcessModule.onReceiveBlock(second);
          } catch (e) {
          }
          expect(blocksModule.lastBlock.id).eq(first.id);

          await expect(txModule.getByID(second.transactions[0].id)).rejectedWith('Transaction not found');
          await expect(txModule.getByID(first.transactions[0].id)).not.rejected;

          expect(await accModule.getAccount({address: first.transactions[0].recipientId})).not.null;
          expect(await accModule.getAccount({address: second.transactions[0].recipientId})).undefined;
        });
        it('tx overspending', async () => {
          do {
            second = await initializer.generateBlock([
              await createSendTransaction(0, Math.ceil(Math.random() * 100000) + 1, createRandomWallet(), '1R')
            ], slots.getSlotNumber());
          } while (second.id > first.id);
          await blocksProcessModule.onReceiveBlock(first);
          expect(blocksModule.lastBlock.id).eq(first.id);
          try {
            await blocksProcessModule.onReceiveBlock(second);
          } catch (e) {
            console.log(e);
          }

          expect(blocksModule.lastBlock.id).eq(first.id);
          await expect(txModule.getByID(second.transactions[0].id)).rejectedWith('Transaction not found');
          await expect(txModule.getByID(first.transactions[0].id)).not.rejected;
          expect(await accModule.getAccount({address: first.transactions[0].recipientId})).not.null;
          expect(await accModule.getAccount({address: second.transactions[0].recipientId})).undefined;
        });
      });
    });
  });

});
