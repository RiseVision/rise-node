import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Sequelize } from 'sequelize-typescript';
import * as filterObject from 'filter-object';
import initializer from './common/init';
import {
  confirmTransactions,
  createRandomAccountsWithFunds,
  createSendTransaction,
  createVoteTransaction,
  findDelegateByPkey,
  findDelegateByUsername
} from './common/utils';
import { Symbols } from '../../src/ioc/symbols';
import { IRoundsLogic, ITransactionLogic, ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  IDelegatesModule,
  IRoundsModule,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../../src/ioc/interfaces/modules';
import { Ed } from '../../src/helpers';
import { dposOffline, LiskWallet } from 'dpos-offline';
import { BlocksModel } from '../../src/models';
import { Op } from 'sequelize';

chai.use(chaiAsPromised);
describe('rounds', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  const funds = Math.pow(10, 11);

  let blocksModule: IBlocksModule;
  let blocksModel: typeof BlocksModel;
  let delegatesModule: IDelegatesModule;
  let accModule: IAccountsModule;
  let txModule: ITransactionsModule;
  let txPool: ITransactionPoolLogic;
  let transportModule: ITransportModule;
  let txLogic: ITransactionLogic;
  let roundsLogic: IRoundsLogic;
  let systemModule: ISystemModule;
  let sequelize: Sequelize;
  let rounds: IRoundsModule;
  let ed: Ed;
  beforeEach(async () => {
    ed              = initializer.appManager.container.get(Symbols.helpers.ed);
    blocksModule    = initializer.appManager.container.get(Symbols.modules.blocks);
    delegatesModule = initializer.appManager.container.get(Symbols.modules.delegates);
    accModule       = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule        = initializer.appManager.container.get(Symbols.modules.transactions);
    transportModule = initializer.appManager.container.get(Symbols.modules.transport);
    txPool          = initializer.appManager.container.get(Symbols.logic.transactionPool);
    txLogic         = initializer.appManager.container.get(Symbols.logic.transaction);
    systemModule    = initializer.appManager.container.get(Symbols.modules.system);
    sequelize       = initializer.appManager.container.get(Symbols.generic.sequelize);
    rounds          = initializer.appManager.container.get(Symbols.modules.rounds);
    roundsLogic     = initializer.appManager.container.get(Symbols.logic.rounds);
    blocksModel     = initializer.appManager.container.get(Symbols.models.blocks);
  });

  function mapDelegate(i: any) {
    return {
      user : i.delegate.username,
      vote : i.delegate.vote,
      bala : i.delegate.balance,
      ubala: i.delegate.u_balance,
      pk   : i.delegate.publicKey.toString('hex'),
      addr : i.delegate.address,
      rank : i.info.rank,
      mb   : i.delegate.missedblocks,
      pb   : i.delegate.producedblocks,
    };
  }

  function mappedDelegatesToHASH<T extends { user: string }>(mappedDelegates: T[]): { [user: string]: T } {
    const toRet = {};
    mappedDelegates.forEach((item) => toRet[item.user] = item);
    return toRet;
  }

  let accounts: LiskWallet[];
  beforeEach(async function () {
    this.timeout(100000);
    const toRet = await createRandomAccountsWithFunds(101, funds);
    accounts    = toRet.map((item) => item.account);
    const txs   = [];
    for (let i = 1; i <= 101; i++) {
      const delegate  = findDelegateByUsername(`genesisDelegate${i}`);
      const delWallet = new dposOffline.wallets.LiskLikeWallet(delegate.secret, 'R');
      txs.push(await createVoteTransaction(
        0,
        delWallet,
        delWallet.publicKey,
        false
      ));
      txs.push(await createVoteTransaction(
        0,
        accounts[i - 1],
        delWallet.publicKey,
        true
      ));
      // reorder so that genesisDelegate1 is higher in rank than genesiDelegate2 by one satoshi
      txs.push(await createSendTransaction(0, i, accounts[i - 1], '1R'));
    }
    await confirmTransactions(txs, false);
  });

  async function getmappedDelObj() {
    const preRes       = await delegatesModule.getDelegates({ orderBy: 'vote:desc' });
    const preResMapped = preRes.delegates.map(mapDelegate);
    return mappedDelegatesToHASH(preResMapped);
  }

  async function getPREPostOBJ() {
    const curRound = roundsLogic.calcRound(blocksModule.lastBlock.height);
    const preOBJ   = await getmappedDelObj();
    const toMine   = roundsLogic.lastInRound(curRound) - blocksModule.lastBlock.height;
    for (let i = 0; i < toMine - 1; i++) {
      await initializer.rawMineBlocks(1);
      expect(filterObject(preOBJ, ['!*.mb', '!*.pb']))
        .to.be.deep.eq(filterObject(await getmappedDelObj(), ['!*.mb', '!*.pb']));
    }
    const preLastBlock = await getmappedDelObj();
    await initializer.rawMineBlocks(1);

    const postOBJ = await getmappedDelObj();

    // should contain same delegates (even if sorted in another order)
    expect(Object.keys(preOBJ).sort()).to.be.deep.eq(Object.keys(postOBJ).sort());
    expect(preOBJ).to.not.be.deep.eq(postOBJ);
    expect(preLastBlock).to.not.be.deep.eq(postOBJ);
    return { preOBJ, preLastBlock, postOBJ };
  }

  describe('endRoundApply', () => {
    it('should update delegates amounts', async function () {
      this.timeout(10000);
      const { preOBJ, postOBJ } = await getPREPostOBJ();

      const blocks       = await blocksModel.findAll({
        where: { height: { [Op.gt]: 1 } }
      });
      const totalRewards = blocks
        .map((x) => x.totalFee)
        .reduce((a, b) => a + b, 0);
      for (const block of blocks) {
        const res      = findDelegateByPkey(block.generatorPublicKey.toString('hex'));
        const username = res.username;
        expect(postOBJ[username].bala).to.be.eq(
          preOBJ[username].bala + block.reward + totalRewards / 101
        );
      }
    });
    it('should update delegate votes and rank!', async function () {
      this.timeout(10000);
      const { preOBJ, preLastBlock, postOBJ } = await getPREPostOBJ();
      for (let i = 1; i <= 101; i++) {
        const delegateName = `genesisDelegate${i}`;
        expect(postOBJ[delegateName].vote).to.be.eq(99890000000 - i);
        expect(delegateName).to.be.eq(`genesisDelegate${i}`);
        expect(postOBJ[delegateName].rank).to.be.eq(i);
        expect(postOBJ[delegateName].vote).to.be.not.eq(preLastBlock[delegateName].vote);
      }
    });
  });
  describe('endRound + rollback', () => {
    it('rollback should return to original preOBJ', async function () {
      this.timeout(20000);
      const { preLastBlock} = await getPREPostOBJ();

      await initializer.rawDeleteBlocks(1);

      const nowOBJ      = await getmappedDelObj();
      expect(nowOBJ).to.be.deep.eq(preLastBlock);
    });
    it('end + rollback + end should give same result as end only', async function () {
      this.timeout(20000);
      const { postOBJ } = await getPREPostOBJ();

      await initializer.rawDeleteBlocks(1);
      await initializer.rawMineBlocks(1);

      const nowOBJ      = await getmappedDelObj();
      expect(nowOBJ).to.be.deep.eq(postOBJ);
    });
  });
});
