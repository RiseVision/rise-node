import { expect } from 'chai';
import {
  createRandomAccountsWithFunds,
  createRegDelegateTransaction, createSecondSignTransaction, createVoteTransaction,
  easyCreateMultiSignAccount
} from './common/utils';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { BlocksModule } from '../../src/modules';
import initializer from './common/init';
import { Symbols } from '../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../src/logic';
import { BlocksModuleChain } from '../../src/modules/blocks/';
import * as supertest from 'supertest';

describe('blockProcessing', async () => {
  let blocksModule: BlocksModule;
  let blocksChainModule: BlocksModuleChain;
  initializer.setup();
  beforeEach(() => {
    blocksModule      = initializer.appManager.container.get(Symbols.modules.blocks);
    blocksChainModule = initializer.appManager.container.get(Symbols.modules.blocksSubModules.chain);
  });
  describe('delete block', () => {
    let creationOps: Array<{ tx: ITransaction, account: LiskWallet, senderWallet: LiskWallet }>;
    let multisigOp: { wallet: LiskWallet, keys: LiskWallet[], tx: ITransaction};
    let block: SignedAndChainedBlockType;
    let initBlock: SignedAndChainedBlockType;
    let regDelegateTX: ITransaction;
    let secondSignTX: ITransaction;
    let voteTX: ITransaction;
    let allTxs: ITransaction[];
    let allAccounts: LiskWallet[];
    initializer.autoRestoreEach();
    beforeEach(async () => {
      initBlock = blocksModule.lastBlock;
      creationOps   = await createRandomAccountsWithFunds(10, 10e10);
      multisigOp = await easyCreateMultiSignAccount(3, 2);
      regDelegateTX = await createRegDelegateTransaction(1, creationOps[0].account, 'meow');
      secondSignTX = await createSecondSignTransaction(1, creationOps[1].account, creationOps[2].account.publicKey);
      voteTX = await createVoteTransaction(1, creationOps[0].account, creationOps[0].account.publicKey, true);

      block = blocksModule.lastBlock;
      allAccounts = creationOps.map((op) => op.account)
        .concat(multisigOp.wallet);
      allTxs = creationOps.map((op) => op.tx)
        .concat(multisigOp.tx)
        .concat(regDelegateTX)
        .concat(secondSignTX)
        .concat(voteTX);

    });
    it('should remove block from db', async () => {
      for (let i = 0; i < block.height - initBlock.height; i++) {
        await blocksChainModule.deleteLastBlock();
      }
      const b = blocksModule.lastBlock;
      expect(blocksModule.lastBlock.height).eq(initBlock.height);
      const res = await supertest(initializer.appManager.expressApp)
        .get('/api/blocks/get?id=' + block.id)
        .expect(200);

      expect(res.body.success).is.false;
      expect(res.body.error).is.eq('Block not found');
    });
    it('should remove txs from db', async () => {
      expect(block.transactions.length).gt(0);
      for (let i = 0; i < block.height - initBlock.height; i++) {
        await blocksChainModule.deleteLastBlock();
      }

      for (const op of allTxs) {
        const txID = op.id;

        const res = await supertest(initializer.appManager.expressApp)
          .get(`/api/transactions/get?id=${txID}`)
          .expect(200);
        expect(res.body.success).is.false;
        expect(res.body.error).is.eq('Transaction not found');
      }
    });
    it('should restore accounts to its original state', async () => {
      for (let i = 0; i < block.height - initBlock.height; i++) {
        await blocksChainModule.deleteLastBlock();
      }

      for (const account of allAccounts) {
        const res = await supertest(initializer.appManager.expressApp)
          .get(`/api/accounts/?address=${account.address}`)
          .expect(200);

        expect(res.body.success).is.true;
        expect(res.body.account.address).is.deep.eq(account.address);
        expect(res.body.account.balance).is.deep.eq('0');
        expect(res.body.account.username).is.undefined;
        expect(res.body.account.multisignatures).is.deep.eq([]);
        expect(res.body.account.secondSignature).is.eq(0);
        expect(res.body.account.secondPublicKey).is.null;
        expect(res.body.account.unconfirmedBalance).is.deep.eq('0');
      }
    });
  });

});
