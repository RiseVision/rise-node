import { SystemModule } from '@risevision/core';
import { AccountsModule } from '@risevision/core-accounts';
import {
  BlocksModel,
  BlocksModule,
  BlocksSymbols,
} from '@risevision/core-blocks';
import {
  BaseDelegateData,
  DelegatesModule,
  dPoSSymbols,
  RoundsLogic,
  RoundsModule,
} from '@risevision/core-consensus-dpos';
import { Crypto } from '@risevision/core-crypto';
import { ModelSymbols } from '@risevision/core-models';
import {
  TransactionLogic,
  TransactionPool,
  TransactionsModule,
  TXSymbols,
} from '@risevision/core-transactions';
import { Address, IKeypair, Symbols } from '@risevision/core-types';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Rise } from 'dpos-offline';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import initializer from './common/init';
import {
  confirmTransactions,
  createRandomAccountsWithFunds,
  createSendTransactionV1,
  createVoteTransactionV1,
  findDelegateByPkey,
  findDelegateByUsername,
} from './common/utils';

chai.use(chaiAsPromised);
describe('rounds', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  const funds = Math.pow(10, 11);

  let blocksModule: BlocksModule;
  let blocksModel: typeof BlocksModel;
  let delegatesModule: DelegatesModule;
  let accModule: AccountsModule;
  let txModule: TransactionsModule;
  let txPool: TransactionPool;

  let txLogic: TransactionLogic;
  let roundsLogic: RoundsLogic;
  let systemModule: SystemModule;
  let sequelize: Sequelize;
  let rounds: RoundsModule;
  let ed: Crypto;
  beforeEach(async () => {
    ed = initializer.appManager.container.get(Symbols.generic.crypto);
    blocksModule = initializer.appManager.container.get(Symbols.modules.blocks);
    delegatesModule = initializer.appManager.container.get(
      dPoSSymbols.modules.delegates
    );
    accModule = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule = initializer.appManager.container.get(TXSymbols.module);

    txPool = initializer.appManager.container.get(TXSymbols.pool);
    txLogic = initializer.appManager.container.get(TXSymbols.logic);
    systemModule = initializer.appManager.container.get(Symbols.modules.system);
    sequelize = initializer.appManager.container.get(ModelSymbols.sequelize);
    rounds = initializer.appManager.container.get(dPoSSymbols.modules.rounds);
    roundsLogic = initializer.appManager.container.get(
      dPoSSymbols.logic.rounds
    );
    blocksModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      BlocksSymbols.model
    );
  });

  function mapDelegate(i: BaseDelegateData) {
    return {
      addr: i.address,
      mb: i.missedblocks,
      pb: i.producedblocks,
      pk: i.forgingPK.toString('hex'),
      user: i.username,
      vote: i.vote,
    };
  }

  function mappedDelegatesToHASH<T extends { user: string }>(
    mappedDelegates: T[]
  ): { [user: string]: T } {
    const toRet = {};
    mappedDelegates.forEach((item) => (toRet[item.user] = item));
    return toRet;
  }

  let accounts: IKeypair[];
  beforeEach(async function() {
    this.timeout(100000);
    const toRet = await createRandomAccountsWithFunds(101, funds);
    accounts = toRet.map((item) => item.account);
    const txs = [];
    for (let i = 1; i <= 101; i++) {
      const delegate = findDelegateByUsername(`genesisDelegate${i}`);
      const delWallet = Rise.deriveKeypair(delegate.secret);
      txs.push(
        await createVoteTransactionV1(
          0,
          {
            ...delWallet,
            address: delegate.address as Address,
          },
          delWallet.publicKey,
          false
        )
      );
      txs.push(
        await createVoteTransactionV1(
          0,
          accounts[i - 1],
          delWallet.publicKey,
          true
        )
      );
      // reorder so that genesisDelegate1 is higher in rank than genesiDelegate2 by one satoshi
      txs.push(await createSendTransactionV1(0, i, accounts[i - 1], '1R'));
    }
    await confirmTransactions(txs, false);
  });

  async function getmappedDelObj() {
    const preRes = await delegatesModule.getDelegates();
    const res = [];
    for (const dele of preRes) {
      const info = await delegatesModule.calcDelegateInfo(dele, preRes);
      const delData = await delegatesModule.getDelegate(dele.username);
      res.push({
        ...mapDelegate(dele),
        bala: delData.account.balance,
        rank: info.rankV1,
        ubala: delData.account.u_balance,
      });
    }
    return mappedDelegatesToHASH(res);
  }

  async function getPREPostOBJ() {
    const curRound = roundsLogic.calcRound(blocksModule.lastBlock.height);
    const preOBJ = await getmappedDelObj();
    const toMine =
      roundsLogic.lastInRound(curRound) - blocksModule.lastBlock.height;

    await initializer.rawMineBlocks(toMine - 1);
    const preLastBlock = await getmappedDelObj();
    await initializer.rawMineBlocks(1);
    const postOBJ = await getmappedDelObj();

    // should contain same delegates (even if sorted in another order)
    expect(Object.keys(preOBJ).sort()).to.be.deep.eq(
      Object.keys(postOBJ).sort()
    );
    expect(preOBJ).to.not.be.deep.eq(postOBJ);
    expect(preLastBlock).to.not.be.deep.eq(postOBJ);
    expect(preOBJ).to.be.deep.eq(preLastBlock);
    return { preOBJ, preLastBlock, postOBJ };
  }

  describe('endRoundApply', () => {
    it('should update delegates amounts', async function() {
      this.timeout(30000);
      const { preOBJ, postOBJ } = await getPREPostOBJ();

      const blocks = await blocksModel.findAll({
        order: [['height', 'ASC']],
        where: { height: { [Op.gt]: 1 } },
      });
      const totalRewards = blocks
        .map((x) => x.totalFee)
        .reduce((a, b) => a + b, 0n);
      for (const block of blocks) {
        const res = findDelegateByPkey(
          block.generatorPublicKey.toString('hex')
        );
        const username = res.username;
        expect(postOBJ[username].bala).to.be.eq(
          preOBJ[username].bala + block.reward + totalRewards / 101n
        );
      }
    });
    it('should update delegate votes and rank!', async function() {
      this.timeout(30000);
      const { postOBJ } = await getPREPostOBJ();
      for (let i = 1; i <= 101; i++) {
        const delegateName = `genesisDelegate${i}`;
        expect(postOBJ[delegateName].vote).to.be.eq(BigInt(99890000000 - i));
        expect(delegateName).to.be.eq(`genesisDelegate${i}`);
        expect(postOBJ[delegateName].rank).to.be.eq(i);
      }
    });
  });
  describe('endRound + rollback', () => {
    it('rollback should return to original preOBJ', async function() {
      this.timeout(30000);
      const { preLastBlock } = await getPREPostOBJ();

      await initializer.rawDeleteBlocks(1);

      const nowOBJ = await getmappedDelObj();
      expect(nowOBJ).to.be.deep.eq(preLastBlock);
    });
    it('end + rollback + end should give same result as end only', async function() {
      this.timeout(30000);
      const { postOBJ } = await getPREPostOBJ();

      await initializer.rawDeleteBlocks(1);
      await initializer.rawMineBlocks(1);

      const nowOBJ = await getmappedDelObj();
      expect(nowOBJ).to.be.deep.eq(postOBJ);
    });
  });

  // Moved to functionsalities/delegateswithMultipleForgingKey test
  // describe('multiroundtests', () => {
  //   it('should allow restore of more than 3 rounds');
  // });
});
