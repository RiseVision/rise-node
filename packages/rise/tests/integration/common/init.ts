import { APISymbols } from '@risevision/core-apis';
import {
  BlockLogic,
  BlocksModule,
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksSymbols,
  PostBlockRequest,
} from '@risevision/core-blocks';
import {
  DelegatesModule,
  dPoSSymbols,
  Slots,
} from '@risevision/core-consensus-dpos';
import { RoundLogic, RoundsLogic } from '@risevision/core-consensus-dpos';
import { loggerCreator } from '@risevision/core-helpers';
import {
  AppManager,
  fetchCoreModuleImplementations,
} from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols, Peer } from '@risevision/core-p2p';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import {
  IBaseModel,
  IBaseTransaction,
  SignedAndChainedBlockType,
} from '@risevision/core-types';
import { expect } from 'chai';
import { RiseTransaction, RiseV2Transaction } from 'dpos-offline';
import 'reflect-metadata';
import { getKeypairByPkey } from './utils';

export class IntegrationTestInitializer {
  public appManager: AppManager;
  public expressApp: Express.Application;
  public apiExpress: Express.Application;
  public setupEach() {
    const s = this;
    beforeEach(function() {
      this.timeout(10000);
      return s.runBefore();
    });
    afterEach(function() {
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
      const blockModule = this.appManager.container.get<BlocksModule>(
        BlocksSymbols.modules.blocks
      );
      height = blockModule.lastBlock.height;
    });
    afterEach(async function() {
      const blockModule = self.appManager.container.get<BlocksModule>(
        BlocksSymbols.modules.blocks
      );
      const howMany = blockModule.lastBlock.height - height;
      this.timeout(howMany * 5000 + 150);
      await self.rawDeleteBlocks(howMany);
      expect(blockModule.lastBlock.height).to.be.eq(height);
    });
  }

  public createBlocks(howMany: number, when: 'each' | 'single') {
    const before = when === 'single' ? 'before' : 'beforeEach';
    const after = when === 'single' ? 'after' : 'afterEach';
    const self = this;
    global[before](async function() {
      this.timeout(howMany * 300 + 150);
      await self.rawMineBlocks(howMany);
    });

    global[after](async function() {
      this.timeout(howMany * 300 + 150);
      await self.rawDeleteBlocks(howMany);
    });
  }

  public async rawDeleteBlocks(howMany: number) {
    const blockModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const blockChainModule = this.appManager.container.get<BlocksModuleChain>(
      BlocksSymbols.modules.chain
    );
    const height = blockModule.lastBlock.height;
    for (let i = 0; i < howMany; i++) {
      await blockChainModule.deleteLastBlock();
    }
    expect(blockModule.lastBlock.height).to.be.eq(height - howMany);
  }

  public async generateBlock(
    transactions: Array<RiseTransaction<any> | RiseV2Transaction<any>> = []
  ): Promise<SignedAndChainedBlockType & { height: number }> {
    const blockLogic = this.appManager.container.get<BlockLogic>(
      BlocksSymbols.logic.block
    );
    const blockModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const height = blockModule.lastBlock.height;
    const delegatesModule = this.appManager.container.get<DelegatesModule>(
      dPoSSymbols.modules.delegates
    );
    const slots = this.appManager.container.get<Slots>(
      dPoSSymbols.helpers.slots
    );
    const delegates = await delegatesModule.generateDelegateList(height + 1);
    const theSlot = height;
    const delegateId = delegates[theSlot % slots.delegates];
    const kp = getKeypairByPkey(delegateId.toString('hex'));

    return blockLogic.create({
      keypair: kp,
      previousBlock: blockModule.lastBlock,
      timestamp: slots.getSlotTime(theSlot),
      transactions: transactions.map((t) => toNativeTx(t)),
    });
  }

  /**
   * Tries to mine a block with a specific set of transactions.
   * Useful when testing edge cases such as over-spending etc.
   * @param {Array<IBaseTransaction<any>>} transactions
   * @returns {Promise<SignedBlockType>}
   */
  public async rawMineBlockWithTxs(
    transactions: Array<IBaseTransaction<any>>,
    through: 'p2p' | 'direct' = 'direct'
  ) {
    const blockLogic = this.appManager.container.get<BlockLogic>(
      BlocksSymbols.logic.block
    );
    const blockModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const delegatesModule = this.appManager.container.get<DelegatesModule>(
      dPoSSymbols.modules.delegates
    );
    const slots = this.appManager.container.get<Slots>(
      dPoSSymbols.helpers.slots
    );
    const height = blockModule.lastBlock.height;

    const delegates = await delegatesModule.generateDelegateList(height + 1);
    const theSlot = height;
    const delegateId = delegates[theSlot % slots.delegates];
    const kp = getKeypairByPkey(delegateId.toString('hex'));

    const newBlock = blockLogic.create({
      keypair: kp,
      previousBlock: blockModule.lastBlock,
      timestamp: slots.getSlotTime(theSlot),
      transactions,
    });
    // mimic process.onReceiveBlock which is wrapped within a BalanceSequence.
    await this.postBlock(newBlock, through);
    return newBlock;
  }

  public async postBlock(
    block: SignedAndChainedBlockType,
    through: 'p2p' | 'direct' = 'p2p'
  ) {
    if (through === 'p2p') {
      const pbr = this.appManager.container.getNamed<PostBlockRequest>(
        p2pSymbols.transportMethod,
        BlocksSymbols.p2p.postBlock
      );
      const pf = this.appManager.container.get<(b: any) => Peer>(
        p2pSymbols.logic.peerFactory
      );
      const p = pf({ ip: '127.0.0.1', port: 9999 });
      const r = await p.makeRequest(pbr, {
        body: { block },
      });
    } else {
      const blockProcess = this.appManager.container.get<BlocksModuleProcess>(
        BlocksSymbols.modules.process
      );
      await blockProcess.processBlock(block);
    }
  }

  public async goToPrevRound(): Promise<void> {
    const blocksModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const roundsLogic = this.appManager.container.get<RoundsLogic>(
      dPoSSymbols.logic.rounds
    );
    const firstInRound = roundsLogic.lastInRound(
      roundsLogic.calcRound(blocksModule.lastBlock.height) - 1
    );

    const toDelete = blocksModule.lastBlock.height - firstInRound;
    await this.rawDeleteBlocks(toDelete);

    expect(blocksModule.lastBlock.height).eq(
      roundsLogic.lastInRound(
        roundsLogic.calcRound(blocksModule.lastBlock.height)
      )
    );
  }

  public async goToNextRound(): Promise<void> {
    const blocksModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const roundsLogic = this.appManager.container.get<RoundsLogic>(
      dPoSSymbols.logic.rounds
    );
    const lastInRound = roundsLogic.lastInRound(
      roundsLogic.calcRound(blocksModule.lastBlock.height)
    );

    const missing = 1 + lastInRound - blocksModule.lastBlock.height;
    await this.rawMineBlocks(missing);

    expect(blocksModule.lastBlock.height).eq(
      roundsLogic.firstInRound(
        roundsLogic.calcRound(blocksModule.lastBlock.height)
      )
    );
  }

  public async rawMineBlocks(howMany: number): Promise<number> {
    // const db              = this.appManager.container.get<IDatabase<any>>(Symbols.generic.db);
    const blockModule = this.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    );
    const delegatesModule = this.appManager.container.get<DelegatesModule>(
      dPoSSymbols.modules.delegates
    );
    const slots = this.appManager.container.get<Slots>(
      dPoSSymbols.helpers.slots
    );
    const blockProcess = this.appManager.container.get<BlocksModuleProcess>(
      BlocksSymbols.modules.process
    );
    const height = blockModule.lastBlock.height;
    // Maybe well need to process with txProcessor.
    // console.log(`Mining ${howMany} blocks from height: ${height}`);
    for (let i = 0; i < howMany; i++) {
      const delegates = await delegatesModule.generateDelegateList(
        height + i + 1
      );
      const theSlot = height + i;
      const delegateId = delegates[theSlot % slots.delegates];
      const kp = getKeypairByPkey(delegateId.toString('hex'));

      const b = await blockProcess.generateBlock(
        kp,
        slots.getSlotTime(theSlot)
      );

      await blockProcess.processBlock(b);
    }
    expect(blockModule.lastBlock.height).to.be.eq(height + howMany);
    return blockModule.lastBlock.height;
  }

  public setup() {
    const s = this;
    before(function() {
      this.timeout(100000);
      return s.runBefore();
    });

    after(function() {
      this.timeout(100000);
      return s.runAfter();
    });
  }

  private createAppManager() {
    this.appManager = new AppManager(
      JSON.parse(
        JSON.stringify(
          require(`${__dirname}/../../../../core-launchpad/tests/unit/assets/config.json`)
        )
      ),
      loggerCreator({
        echo: 'error',
        filename: '/dev/null',
      }),
      'integration-version',
      JSON.parse(
        JSON.stringify(
          require(`${__dirname}/../../../../core-launchpad/tests/unit/assets/genesisBlock.json`)
        )
      ),
      fetchCoreModuleImplementations(`${__dirname}/../../../`)
    );
  }

  private async runBefore() {
    process.env.NODE_ENV = 'test';
    process.env.NETWORK = 'devnet';
    this.createAppManager();
    await this.appManager.initAppElements();
    await this.appManager.finishBoot();
    this.expressApp = this.appManager.container.get(p2pSymbols.express);
    this.apiExpress = this.appManager.container.get(APISymbols.express);
  }

  private async runAfter() {
    const BlocksModel: typeof IBaseModel = this.appManager.container.getNamed(
      ModelSymbols.model,
      BlocksSymbols.model
    );
    await this.appManager.tearDown();
    const tables = [
      'blocks',
      'delegatesround',
      'exceptions',
      'info',
      'mem_accounts',
      'mem_accounts2delegates',
      'mem_accounts2u_delegates',
      // 'migrations',
      'peers',
      'rounds_fees',
      'trs',
      'trsassets_delegates',
      'trsassets_secondsignature',
      'trsassets_send',
      'trsassets_votes',
      'trsassets_votes_old',
    ];

    await BlocksModel.sequelize.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  }
}

export default new IntegrationTestInitializer();
