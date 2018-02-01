import * as mute from 'mute';
import { expect } from 'chai';
import * as monitor from 'pg-monitor';
import { Bus, constants, loggerCreator, Slots } from '../../../src/helpers';
import { AppManager } from '../../../src/AppManager';
import { Symbols } from '../../../src/ioc/symbols';
import { IDatabase } from 'pg-promise';
import {
  IBlocksModule, IBlocksModuleChain,
  IBlocksModuleProcess,
  IDelegatesModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { getKeypairByPkey } from './utils';

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

  public createBlocks(howMany: number, when: 'each' | 'single') {
    const before = when === 'single' ? 'before' : 'beforeEach';
    const after  = when === 'single' ? 'after' : 'afterEach';
    global[before](async () => {
      await this.rawMineBlocks(howMany);
    });

    global[after](async () => {
      await this.rawDeleteBlocks(howMany);
    });

  }

  public async rawDeleteBlocks(howMany: number) {
    const blockModule     = this.appManager.container
      .get<IBlocksModule>(Symbols.modules.blocks);
    const blockChainModule = this.appManager.container
      .get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
    const height          = blockModule.lastBlock.height;
    for (let i = 0; i < howMany; i++) {
      await blockChainModule.deleteLastBlock();
    }
    expect(blockModule.lastBlock.height).to.be.eq(height - howMany);
  }

  public async rawMineBlocks(howMany: number): Promise<number> {
    const blockModule     = this.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    const txModule        = this.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
    const blockProcess    = this.appManager.container.get<IBlocksModuleProcess>(Symbols.modules.blocksSubModules.process);
    const delegatesModule = this.appManager.container.get<IDelegatesModule>(Symbols.modules.delegates);
    const slots           = this.appManager.container.get<Slots>(Symbols.helpers.slots);
    const height          = blockModule.lastBlock.height;
    for (let i = 0; i < howMany; i++) {
      const delegates  = await delegatesModule.generateDelegateList(height + i + 1);
      const theSlot    = height + i + 1;
      const delegateId = delegates[theSlot % slots.delegates];
      const kp         = getKeypairByPkey(delegateId);
      await txModule.fillPool();
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
      'integration-testing',
      'integration-version',
      require('../genesisBlock.json'),
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
    const db: IDatabase<any> = this.appManager.container.get(Symbols.generic.db);
    await this.appManager.tearDown();
    monitor.detach();
    const tables = ['blocks', 'dapps', 'delegates', 'forks_stat', 'intransfer', 'mem_accounts',
      'mem_accounts2delegates',
      'mem_accounts2multisignatures', 'mem_accounts2u_delegates', 'mem_accounts2u_multisignatures', 'mem_round',
      // 'migrations',
      'multisignatures', 'outtransfer', 'peers', 'peers_dapp', 'rounds_fees', 'signatures', 'trs', 'votes'];

    for (const table of tables) {
      await db.query('TRUNCATE $1:name CASCADE', table);
    }
  }

}

export default new IntegrationTestInitializer();
