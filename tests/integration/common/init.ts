import * as monitor from 'pg-monitor';
import { constants, loggerCreator } from '../../../src/helpers';
import { AppManager } from '../../../src/AppManager';
import { Symbols } from '../../../src/ioc/symbols';
import { IDatabase } from 'pg-promise';

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

  public setup() {
    const s = this;
    before(function () {
      this.timeout(10000);
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
