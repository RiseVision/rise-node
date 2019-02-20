import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { Peer } from '@risevision/core-p2p';
import { IBlocksModule, Symbols } from '@risevision/core-types';
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
  let syncWithPeer: (peerProvider: () => Promise<Peer>) => Promise<void>;
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
    const blocksModuleProcess: BlocksModuleProcess = container.get(
      BlocksSymbols.modules.process
    );
    const blocksChainModule: BlocksModuleChain = container.get(
      BlocksSymbols.modules.chain
    );

    getCommonBlockStub = sandbox.stub(blocksModuleProcess, 'getCommonBlock');
    deleteLastBlockStub = sandbox.stub(blocksChainModule, 'deleteLastBlock');
    loadBlocksFromPeerStub = sandbox.stub(
      blocksModuleProcess,
      'loadBlocksFromPeer'
    );

    // de-register current hooks and register a new hookSystem to isolate tests.
    await instance.unHook();
    instance.hookSystem = hookSystem;
    delete instance.__wpuid;
    await instance.hookMethods();

    syncWithPeer = (instance as any).syncWithPeer.bind(instance);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('syncWithPeer', () => {
    it('should skip common block calls for genesis block', async () => {
      blocksModule.lastBlock = { height: 1, id: '1' } as any;
      loadBlocksFromPeerStub.callsFake(async () => {
        blocksModule.lastBlock = createFakeBlock(container);
      });

      const inSyncWithPeer = await syncWithPeer({ height: 2 } as any);

      expect(getCommonBlockStub.notCalled).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(2);
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

      const inSyncWithPeer = await syncWithPeer({ height: 3 } as any);

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(3);
    });

    it("should return true when peer doesn't send newer blocks", async () => {
      blocksModule.lastBlock = createFakeBlock(container);
      getCommonBlockStub.resolves({
        height: blocksModule.lastBlock.height,
        id: blocksModule.lastBlock.id,
        previousBlock: blocksModule.lastBlock.previousBlock,
      });
      loadBlocksFromPeerStub.resolves();

      const inSyncWithPeer = await syncWithPeer({ height: 2 } as any);

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(2);
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

      const inSyncWithPeer = await syncWithPeer({ height: 2 } as any);

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(6);
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

      const inSyncWithPeer = await syncWithPeer({ height: 5 } as any);

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.notCalled).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.false;
      expect(blocksModule.lastBlock.height).to.eq(3);
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

      const inSyncWithPeer = await syncWithPeer({ height: 6 } as any);

      expect(getCommonBlockStub.calledOnce).to.be.true;
      expect(deleteLastBlockStub.calledThrice).to.be.true;
      expect(loadBlocksFromPeerStub.calledOnce).to.be.true;
      expect(inSyncWithPeer).to.be.true;
      expect(blocksModule.lastBlock.height).to.eq(6);
    });
  });
});
