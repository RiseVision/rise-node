import { expect } from 'chai';
import 'reflect-metadata';
import { Bus, constants, loggerCreator, Sequence, Slots } from '../../../src/helpers';
import { AppManager } from '../../../src/AppManager';
import { Symbols } from '../../../src/ioc/symbols';
import {
  IBlocksModule,
  IBlocksModuleChain,
  IBlocksModuleProcess, IBlocksModuleVerify,
  IDelegatesModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { getKeypairByPkey } from './utils';
import { SignedBlockType } from '../../../src/logic';
import { IBlockLogic } from '../../../src/ioc/interfaces/logic';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { toBufferedTransaction } from '../../utils/txCrafter';
import { MigrationsModel } from '../../../src/models';
import { IBaseTransaction } from '../../../src/logic/transactions';
import { SequenceStub } from '../../stubs';

export class IntegrationTestInitializer {
  public appManager: AppManager;

  public setupEach() {
    const s = this;
    beforeEach(function () {
      this.timeout(10000);
      return s.runBefore();
    });
    afterEach(function()  {
      this.timeout(10000);
      return s.runAfter();
    });
  }

  /**
   * Keeps note of the current block and automatically deletes the blocks on afterEach.
   */
  public autoRestoreEach() {
    let height: number;
    const self = this;
    beforeEach(() => {
      const blockModule = this.appManager.container
        .get<IBlocksModule>(Symbols.modules.blocks);
      height            = blockModule.lastBlock.height;
    });
    afterEach(async function () {

      const blockModule = self.appManager.container
        .get<IBlocksModule>(Symbols.modules.blocks);
      const howMany      = blockModule.lastBlock.height - height;
      this.timeout(howMany * 5000 + 150);
      await self.rawDeleteBlocks(howMany);
      expect(blockModule.lastBlock.height).to.be.eq(height);
    });
  }

  public createBlocks(howMany: number, when: 'each' | 'single') {
    const before = when === 'single' ? 'before' : 'beforeEach';
    const after  = when === 'single' ? 'after' : 'afterEach';
    const self = this;
    global[before](async function () {
      this.timeout(howMany * 300 + 150);
      await self.rawMineBlocks(howMany);
    });

    global[after](async function () {
      this.timeout(howMany * 300 + 150);
      await self.rawDeleteBlocks(howMany);
    });

  }

  public async rawDeleteBlocks(howMany: number) {
    const blockModule      = this.appManager.container
      .get<IBlocksModule>(Symbols.modules.blocks);
    const blockChainModule = this.appManager.container
      .get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
    const height           = blockModule.lastBlock.height;
    for (let i = 0; i < howMany; i++) {
      await blockChainModule.deleteLastBlock();
    }
    expect(blockModule.lastBlock.height).to.be.eq(height - howMany);
  }

  public async generateBlock(transactions: Array<ITransaction<any>> = []): Promise<SignedBlockType & {height: number}> {
    const blockLogic      = this.appManager.container.get<IBlockLogic>(Symbols.logic.block);
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const height          = blockModule.lastBlock.height;
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const delegates       = await delegatesModule.generateDelegateList(height + 1);
    const theSlot         = height;
    const delegateId      = delegates[theSlot % slots.delegates];
    const kp              = getKeypairByPkey(delegateId.toString('hex'));

    return blockLogic.create({
      keypair      : kp,
      previousBlock: blockModule.lastBlock,
      timestamp    : slots.getSlotTime(theSlot),
      transactions : transactions.map((t) => toBufferedTransaction(t)),
    });
  }

  /**
   * Tries to mine a block with a specific set of transactions.
   * Useful when testing edge cases such as over-spending etc.
   * @param {Array<IBaseTransaction<any>>} transactions
   * @returns {Promise<SignedBlockType>}
   */
  public async rawMineBlockWithTxs(transactions: Array<IBaseTransaction<any>>) {
    const blockLogic = this.appManager.container.get<IBlockLogic>(Symbols.logic.block);
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const blocksVerifyModule     = this.appManager.container.get<IBlocksModuleVerify>(Symbols.modules.blocksSubModules.verify);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const defaultSequence = this.appManager.container.getTagged<Sequence>(
      Symbols.helpers.sequence,
      Symbols.helpers.sequence,
      Symbols.tags.helpers.defaultSequence);
    const height = blockModule.lastBlock.height;

    const delegates  = await delegatesModule.generateDelegateList(height + 1);
    const theSlot    = height;
    const delegateId = delegates[theSlot % slots.delegates];
    const kp         = getKeypairByPkey(delegateId.toString('hex'));

    const newBlock = blockLogic.create({
      keypair      : kp,
      previousBlock: blockModule.lastBlock,
      timestamp    : slots.getSlotTime(theSlot),
      transactions,
    });
    // mimic process.onReceiveBlock which is wrapped within a BalanceSequence.
    await defaultSequence.addAndPromise(() => blocksVerifyModule.processBlock(newBlock, false, true));
    return newBlock;
  }

  public async rawMineBlocks(howMany: number): Promise<number> {
    // const db              = this.appManager.container.get<IDatabase<any>>(Symbols.generic.db);
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const txModule        = this.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
    const blockProcess    = this.appManager.container.get<IBlocksModuleProcess>(Symbols.modules.blocksSubModules.process);
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const height          = blockModule.lastBlock.height;
    // console.log(`Mining ${howMany} blocks from height: ${height}`);
    for (let i = 0; i < howMany; i++) {
      const delegates  = await delegatesModule.generateDelegateList(height + i + 1);
      const theSlot    = height + i ;
      const delegateId = delegates[theSlot % slots.delegates];
      const kp         = getKeypairByPkey(delegateId.toString('hex'));
      await txModule.fillPool();
      // console.log(await db.query(sql.list({
      //  where     : ['"b_height" = ${height}'],
      // }), {height: height + i + 1, limit: 1, offset: 0}));
      await blockProcess.generateBlock(
        kp,
        slots.getSlotTime(theSlot)
      );
    }
    expect(blockModule.lastBlock.height).to.be.eq(height + howMany);
    return blockModule.lastBlock.height;
  }

  public setup() {
    const s = this;
    before(function () {
      this.timeout(100000);
      return s.runBefore();
    });

    after(function () {
      this.timeout(100000);
      return s.runAfter();
    });
  }

  private createAppManager() {
    this.appManager = new AppManager(
      JSON.parse(JSON.stringify(require('../config.json'))),
      loggerCreator({
        echo    : 'none',
        filename: '/dev/null',
      }),
      'integration-version',
      JSON.parse(JSON.stringify(require('../genesisBlock.json'))),
      constants,
      []
    );
  }

  private async runBefore() {

    this.createAppManager();
    await this.appManager.initAppElements();
    await this.appManager.initExpress();
    await this.appManager.finishBoot();

    const bus = this.appManager.container.get<Bus>(Symbols.helpers.bus);
    await bus.message('syncFinished');
  }

  private async runAfter() {
    const migrations: typeof MigrationsModel = this.appManager.container.get(Symbols.models.migrations);
    await this.appManager.tearDown();
    const tables = ['blocks', 'delegates', 'forks_stat', 'mem_accounts',
      'info',
      'mem_accounts2delegates',
      'mem_accounts2multisignatures', 'mem_accounts2u_delegates', 'mem_accounts2u_multisignatures', 'mem_round',
      // 'migrations',
      'multisignatures', 'peers', 'rounds_fees', 'signatures', 'trs', 'votes'];

    await migrations.sequelize.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  }

}

export default new IntegrationTestInitializer();
