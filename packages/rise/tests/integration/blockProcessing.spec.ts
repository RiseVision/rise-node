import {
  BlocksModule,
  BlocksModuleChain,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { IKeypair } from '@risevision/core-types';
import { expect } from 'chai';
import { Rise, RiseV2Transaction } from 'dpos-offline';
import 'reflect-metadata';
import * as supertest from 'supertest';
import initializer from './common/init';
import {
  createRandomAccountsWithFunds,
  createRegDelegateTransactionV1,
  createSecondSignTransactionV1,
  createVoteTransactionV1,
} from './common/utils';

// tslint:disable no-unused-expression
describe('blockProcessing', async function() {
  this.timeout(100000);
  let blocksModule: BlocksModule;
  let blocksChainModule: BlocksModuleChain;
  initializer.setup();
  beforeEach(() => {
    blocksModule = initializer.appManager.container.get(
      BlocksSymbols.modules.blocks
    );
    blocksChainModule = initializer.appManager.container.get(
      BlocksSymbols.modules.chain
    );
  });
  describe('delete block', () => {
    let creationOps: Array<{
      tx: RiseV2Transaction<any>;
      account: IKeypair;
      senderWallet: IKeypair;
    }>;
    let block: SignedAndChainedBlockType;
    let initBlock: SignedAndChainedBlockType;
    let regDelegateTX: RiseV2Transaction<any>;
    let secondSignTX: RiseV2Transaction<any>;
    let voteTX: RiseV2Transaction<any>;
    let allTxs: Array<RiseV2Transaction<any>>;
    let allAccounts: IKeypair[];
    initializer.autoRestoreEach();
    beforeEach(async () => {
      initBlock = blocksModule.lastBlock;
      creationOps = await createRandomAccountsWithFunds(10, 10e10);
      regDelegateTX = await createRegDelegateTransactionV1(
        1,
        creationOps[0].account,
        'meow'
      );
      secondSignTX = await createSecondSignTransactionV1(
        1,
        creationOps[1].account,
        creationOps[2].account.publicKey
      );
      voteTX = await createVoteTransactionV1(
        1,
        creationOps[0].account,
        creationOps[0].account.publicKey,
        true
      );

      block = blocksModule.lastBlock;
      allAccounts = creationOps.map((op) => op.account);
      allTxs = creationOps
        .map((op) => op.tx)
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
      const res = await supertest(initializer.apiExpress)
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

        const res = await supertest(initializer.apiExpress)
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
        const res = await supertest(initializer.apiExpress)
          .get(
            `/api/accounts/?address=${Rise.calcAddress(
              account.publicKey,
              'main',
              'v0'
            )}`
          )
          .expect(200);

        expect(res.body.success).is.true;
        expect(res.body.account.address).is.deep.eq(
          Rise.calcAddress(account.publicKey, 'main', 'v0')
        );
        expect(res.body.account.balance).is.deep.eq('0');
        expect(res.body.account.username).is.undefined;
        expect(res.body.account.secondSignature).is.eq(0);
        expect(res.body.account.secondPublicKey).is.null;
        expect(res.body.account.unconfirmedBalance).is.deep.eq('0');
      }
    });
  });
});
