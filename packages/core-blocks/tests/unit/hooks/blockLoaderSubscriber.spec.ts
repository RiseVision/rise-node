import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { Peer } from '@risevision/core-p2p';
import {
  IAccountsModule,
  IBlocksModule,
  ILogger,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import {
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksSymbols,
} from '../../../src';
import { BlockLoader } from '../../../src/hooks/subscribers';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression no-identical-functions no-big-function

describe('blocks/hooks/loader', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: BlockLoader;
  let blocksModule: IBlocksModule;
  let getCommonBlockStub: SinonStub;
  let deleteLastBlockStub: SinonStub;
  let loadBlocksFromPeerStub: SinonStub;
  let txAccountsStub: SinonStub;
  let applyBlockStub: SinonStub;
  let hookSystem: WordPressHookSystem;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
    hookSystem = new WordPressHookSystem(new InMemoryFilterModel());
    instance = container.get(BlocksSymbols.__internals.loader);
    blocksModule = container.get(Symbols.modules.blocks);

    // de-register current hooks and register a new hookSystem to isolate tests.
    await instance.unHook();
    instance.hookSystem = hookSystem;
    delete instance.__wpuid;
    await instance.hookMethods();

    const blocksModuleProcess: BlocksModuleProcess = container.get(
      BlocksSymbols.modules.process
    );
    const blocksChainModule: BlocksModuleChain = container.get(
      BlocksSymbols.modules.chain
    );
    const accountsModule: IAccountsModule = container.get(
      Symbols.modules.accounts
    );

    getCommonBlockStub = sandbox.stub(blocksModuleProcess, 'getCommonBlock');
    deleteLastBlockStub = sandbox.stub(blocksChainModule, 'deleteLastBlock');
    loadBlocksFromPeerStub = sandbox.stub(
      blocksModuleProcess,
      'loadBlocksFromPeer'
    );
    txAccountsStub = sandbox.stub(accountsModule, 'txAccounts');
    applyBlockStub = sandbox.stub(blocksChainModule, 'applyBlock');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('syncWithPeer', () => {
    let syncWithPeer: (
      syncPeer: Peer,
      chainBackup: SignedAndChainedBlockType[]
    ) => Promise<void>;
    let chainBackup: SignedAndChainedBlockType[];

    beforeEach(() => {
      syncWithPeer = (instance as any).syncWithPeer.bind(instance);
      chainBackup = [];
    });

    it('should skip common block calls for genesis block', async () => {
      blocksModule.lastBlock = { height: 1, id: '1' } as any;
      loadBlocksFromPeerStub.callsFake(async () => {
        blocksModule.lastBlock = createFakeBlock(container);
      });

      const inSyncWithPeer = await syncWithPeer(
        { height: 2 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.notCalled).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(2);
      expect(chainBackup).to.be.empty;
    });

    it('should return true when peer returns more blocks', async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      getCommonBlockStub.resolves({
        height: blocksModule.lastBlock.height,
        id: blocksModule.lastBlock.id,
        previousBlock: blocksModule.lastBlock.previousBlock,
      });
      loadBlocksFromPeerStub.callsFake(async () => {
        blocksModule.lastBlock = createFakeBlock(container, {
          previousBlock: blocksModule.lastBlock,
        });
      });

      const inSyncWithPeer = await syncWithPeer(
        { height: 3 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(3);
      expect(chainBackup).to.be.empty;
    });

    it("should return true when peer doesn't send newer blocks", async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      getCommonBlockStub.resolves({
        height: blocksModule.lastBlock.height,
        id: blocksModule.lastBlock.id,
        previousBlock: blocksModule.lastBlock.previousBlock,
      });
      loadBlocksFromPeerStub.resolves();

      const inSyncWithPeer = await syncWithPeer(
        { height: 2 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(2);
      expect(chainBackup).to.be.empty;
    });

    it('should return true when peer sends more blocks than what we knew of', async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      getCommonBlockStub.resolves({
        height: blocksModule.lastBlock.height,
        id: blocksModule.lastBlock.id,
        previousBlock: blocksModule.lastBlock.previousBlock,
      });
      loadBlocksFromPeerStub.callsFake(async () => {
        for (let i = 0; i < 4; i++) {
          blocksModule.lastBlock = createFakeBlock(container, {
            previousBlock: blocksModule.lastBlock,
          });
        }
      });

      const inSyncWithPeer = await syncWithPeer(
        { height: 2 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(6);
      expect(chainBackup).to.be.empty;
    });

    it('should return false when we need to download more blocks', async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      getCommonBlockStub.resolves({
        height: blocksModule.lastBlock.height,
        id: blocksModule.lastBlock.id,
        previousBlock: blocksModule.lastBlock.previousBlock,
      });
      loadBlocksFromPeerStub.callsFake(async () => {
        blocksModule.lastBlock = createFakeBlock(container, {
          previousBlock: blocksModule.lastBlock,
        });
      });

      const inSyncWithPeer = await syncWithPeer(
        { height: 5 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.false;
      expect(blocksModule.lastBlock.height).to.eq(3);
      expect(chainBackup).to.be.empty;
    });

    it('should rollback local chain when peer on different fork', async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      const localChain = [blocksModule.lastBlock];
      for (let i = 0; i < 3; i++) {
        blocksModule.lastBlock = createFakeBlock(container, {
          previousBlock: blocksModule.lastBlock,
        });
        localChain.push(blocksModule.lastBlock);
      }
      const expectedChainBackup = localChain.slice(1);
      expectedChainBackup.reverse();

      getCommonBlockStub.resolves({
        height: localChain[0].height,
        id: localChain[0].id,
        previousBlock: localChain[0].previousBlock,
      });
      deleteLastBlockStub.callsFake(async () => {
        localChain.pop();
        blocksModule.lastBlock = localChain[localChain.length - 1];
        return blocksModule.lastBlock;
      });
      loadBlocksFromPeerStub.callsFake(async () => {
        blocksModule.lastBlock = localChain[0];
        for (let i = 0; i < 4; i++) {
          blocksModule.lastBlock = createFakeBlock(container, {
            previousBlock: blocksModule.lastBlock,
          });
        }
      });

      const inSyncWithPeer = await syncWithPeer(
        { height: 6 } as any,
        chainBackup
      );

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.calledThrice).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(6);
      expect(chainBackup).to.deep.equal(expectedChainBackup);
    });
  });

  describe('syncWithNetwork', () => {
    let syncWithNetwork: (peerProvider: () => Promise<Peer>) => Promise<void>;
    let syncWithPeerStub: SinonStub;

    beforeEach(() => {
      // Disable the retrying logic
      sandbox.stub(instance as any, 'promiseRetry').value((fn: any) => {
        const retry = (err) => Promise.reject(err);
        return fn(retry, 1);
      });

      syncWithPeerStub = sandbox.stub(instance as any, 'syncWithPeer');
      syncWithNetwork = (instance as any).syncWithNetwork.bind(instance);
    });

    it('should warn about failure when no peers available', async () => {
      const logger: ILogger = container.get(Symbols.helpers.logger);
      const warnStub = sandbox.stub(logger, 'warn');

      const p = syncWithNetwork(async () => undefined);
      await expect(p).to.be.fulfilled;
      expect(warnStub.calledOnce).to.be.true;
      expect(syncWithPeerStub.notCalled).to.be.true;
    });

    it('should warn about failure when sync fails', async () => {
      const logger: ILogger = container.get(Symbols.helpers.logger);
      const warnStub = sandbox.stub(logger, 'warn');
      syncWithPeerStub.rejects();

      const p = syncWithNetwork(async () => {
        return { height: 1 } as any;
      });
      await expect(p).to.be.fulfilled;
      expect(syncWithPeerStub.calledOnce).to.be.true;
      expect(warnStub.calledOnce).to.be.true;
    });

    it('should restore pre-sync backup for bad fork', async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      const localChain = [blocksModule.lastBlock];
      for (let i = 0; i < 4; i++) {
        blocksModule.lastBlock = createFakeBlock(container, {
          previousBlock: blocksModule.lastBlock,
        });
        localChain.push(blocksModule.lastBlock);
      }
      const expectedLocalChain = localChain.slice();

      syncWithPeerStub.callsFake(
        async (peer, chainBackup): Promise<boolean> => {
          // Simulate rollback
          while (localChain.length > 1) {
            chainBackup.push(localChain.pop());
            blocksModule.lastBlock = localChain[localChain.length - 1];
          }

          // Simulate downloading new chain
          for (let i = 0; i < 3; i++) {
            blocksModule.lastBlock = createFakeBlock(container, {
              previousBlock: blocksModule.lastBlock,
            });
            localChain.push(blocksModule.lastBlock);
          }

          return true;
        }
      );
      deleteLastBlockStub.callsFake(async () => {
        localChain.pop();
        blocksModule.lastBlock = localChain[localChain.length - 1];
        return blocksModule.lastBlock;
      });
      txAccountsStub.resolves({});
      applyBlockStub.callsFake(async (block) => {
        localChain.push(block);
        blocksModule.lastBlock = localChain[localChain.length - 1];
      });

      const p = syncWithNetwork(async () => {
        return { height: 4 } as any;
      });
      await expect(p).to.be.fulfilled;

      expect(deleteLastBlockStub.callCount).to.equal(3);
      expect(txAccountsStub.callCount).to.equal(4);
      expect(applyBlockStub.callCount).to.equal(4);
      expect(localChain).to.deep.equal(expectedLocalChain);
    });
  });
});
