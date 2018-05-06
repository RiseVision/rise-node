import { expect } from 'chai';
import * as monitor from 'pg-monitor';
import 'reflect-metadata';
import { Bus, constants, loggerCreator, Slots } from '../../../src/helpers';
import { AppManager } from '../../../src/AppManager';
import { Symbols } from '../../../src/ioc/symbols';
import { IDatabase } from 'pg-promise';
import {
  IBlocksModule,
  IBlocksModuleChain,
  IBlocksModuleProcess,
  IDelegatesModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { getKeypairByPkey } from './utils';
import { SignedBlockType } from '../../../src/logic';
import { IBlockLogic } from '../../../src/ioc/interfaces/logic';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { toBufferedTransaction } from '../../utils/txCrafter';
import { MigrationsModel } from '../../../src/models';

export class IntegrationTestInitializer {
  public appManager: AppManager;

  public setupEach() {
    const s = this;
    beforeEach(function () {
      this.timeout(10000);
      return s.runBefore();
    });
    afterEach(() => this.runAfter());
  }

  /**
   * Keeps note of the current block and automatically deletes the blocks on afterEach.
   */
  public autoRestoreEach() {
    let height: number;
    beforeEach(() => {
      const blockModule = this.appManager.container
        .get<IBlocksModule>(Symbols.modules.blocks);
      height            = blockModule.lastBlock.height;
    });
    afterEach(async () => {
      const blockModule = this.appManager.container
        .get<IBlocksModule>(Symbols.modules.blocks);
      await this.rawDeleteBlocks(blockModule.lastBlock.height - height);
      expect(blockModule.lastBlock.height).to.be.eq(height);
    });
  }

  public createBlocks(howMany: number, when: 'each' | 'single') {
    const before = when === 'single' ? 'before' : 'beforeEach';
    const after  = when === 'single' ? 'after' : 'afterEach';
    const self = this;
    global[before](async function () {
      this.timeout(howMany * 100 + 150);
      await self.rawMineBlocks(howMany);
    });

    global[after](async function () {
      this.timeout(howMany * 100 + 150);
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

  public async generateBlock(transactions: Array<ITransaction<any>> = []): Promise<SignedBlockType> {
    const blockLogic      = this.appManager.container.get<IBlockLogic>(Symbols.logic.block);
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const height          = blockModule.lastBlock.height;
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const delegates       = await delegatesModule.generateDelegateList(height + 1);
    const theSlot         = height + 1;
    const delegateId      = delegates[theSlot % slots.delegates];
    const kp              = getKeypairByPkey(delegateId.toString('hex'));

    return blockLogic.create({
      keypair      : kp,
      previousBlock: blockModule.lastBlock,
      timestamp    : slots.getSlotTime(theSlot),
      transactions : transactions.map((t) => toBufferedTransaction(t)),
    });
  }

  public async rawMineBlocks(howMany: number): Promise<number> {
    // const db              = this.appManager.container.get<IDatabase<any>>(Symbols.generic.db);
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const txModule        = this.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
    const blockProcess    = this.appManager.container.get<IBlocksModuleProcess>(Symbols.modules.blocksSubModules.process);
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const height          = blockModule.lastBlock.height;
     console.log(`Mining ${howMany} blocks from height: ${height}`);
    for (let i = 0; i < howMany; i++) {
      const delegates  = await delegatesModule.generateDelegateList(height + i + 1);
      const theSlot    = height + i + 1;
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

    after(() => this.runAfter());
  }

  private createAppManager() {
    this.appManager = new AppManager(
      require('../config.json'),
      loggerCreator({
        echo    : 'error',
        filename: '/dev/null',
      }),
      'integration-version',
      require('../genesisBlock.json'),
      constants,
      []
    );
  }

  private async runBefore() {

    this.createAppManager();
    console.log('hey');
    await this.appManager.initAppElements();
    console.log('hey2');
    await this.appManager.initExpress();
    console.log('hey3');
    await this.appManager.finishBoot();
    console.log('hey4');

    const bus = this.appManager.container.get<Bus>(Symbols.helpers.bus);
    await bus.message('syncFinished');
  }

  private async runAfter() {
    const migrations: typeof MigrationsModel = this.appManager.container.get(Symbols.models.migrations);
    await this.appManager.tearDown();
    const tables = ['blocks', 'delegates', 'forks_stat', 'mem_accounts',
      'mem_accounts2delegates',
      'mem_accounts2multisignatures', 'mem_accounts2u_delegates', 'mem_accounts2u_multisignatures', 'mem_round',
      // 'migrations',
      'multisignatures', 'peers', 'rounds_fees', 'signatures', 'trs', 'votes'];

    for (const table of tables) {
      await migrations.sequelize.query(`TRUNCATE ${table} CASCADE`);
    }
  }

}

export default new IntegrationTestInitializer();
