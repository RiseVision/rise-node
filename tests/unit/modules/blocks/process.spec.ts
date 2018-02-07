import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { IBlocksModuleProcess } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { BlocksModuleProcess } from '../../../../src/modules/blocks/';
import { BlocksSubmoduleChainStub, BlocksSubmoduleUtilsStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import TransportModuleStub from '../../../stubs/modules/TransportModuleStub';
import { IAppState } from '../../../../src/ioc/interfaces/logic';
import { AppStateStub } from '../../../stubs/logic/AppStateStub';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks/process', () => {
  let inst: IBlocksModuleProcess;
  let instR: BlocksModuleProcess;
  let container: Container;
  const sandbox = sinon.sandbox.create();
  beforeEach(() => {
    container = createContainer();
    container.rebind(Symbols.modules.blocksSubModules.process).to(BlocksModuleProcess);

    inst = instR = container.get(Symbols.modules.blocksSubModules.process);
  });
  afterEach(() => {
    sandbox.restore();
  });

  // let accountsModule: AccountsModuleStub;
  // let blocksModule: BlocksModuleStub;
  let appState: AppStateStub;
  let blocksChain: BlocksSubmoduleChainStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let transportModule: TransportModuleStub;
  // let txModule: TransactionsModuleStub;
  // let txLogic: TransactionLogicStub;
  // let blockLogic: BlockLogicStub;
  // let roundsModule: RoundsModuleStub;
  // let dbStub: DbStub;
  // let busStub: BusStub;
  beforeEach(() => {
    appState = container.get(Symbols.logic.appState);
    // accountsModule = container.get(Symbols.modules.accounts);
    blocksUtils = container.get(Symbols.modules.blocksSubModules.utils);
    blocksChain   = container.get(Symbols.modules.blocksSubModules.chain);
    // roundsModule   = container.get(Symbols.modules.rounds);
    // txModule       = container.get(Symbols.modules.transactions);
    // txLogic        = container.get(Symbols.logic.transaction);
    // blockLogic     = container.get(Symbols.logic.block);
    transportModule = container.get(Symbols.modules.transport);
    // dbStub  = container.get(Symbols.generic.db);
    // busStub = container.get(Symbols.helpers.bus);

  });

  describe('getCommonBlock', () => {
    beforeEach(() => {
      blocksUtils.enqueueResponse('getIdSequence', { ids: ['1', '2', '3', '4', '5'] });
    });
    it('should get idSequence first', async () => {
      try {
        await inst.getCommonBlock(null, 10);
      } catch (e) {
      }
      expect(blocksUtils.stubs.getIdSequence.called).is.true;
      expect(blocksUtils.stubs.getIdSequence.firstCall.args[0]).is.eq(10);
    });
    it('should call transportModule getFromPeer with proper data', async () => {
      transportModule.enqueueResponse('getFromPeer', Promise.resolve());
      try {
        await inst.getCommonBlock({ peer: 'peer' } as any, 10);
      } catch (e) {
      }
      expect(transportModule.stubs.getFromPeer.called).is.true;
      expect(transportModule.stubs.getFromPeer.firstCall.args[0]).to.be.deep.eq({ peer: 'peer' });
      expect(transportModule.stubs.getFromPeer.firstCall.args[1]).to.be.deep.eq({
        api   : '/blocks/common?ids=1,2,3,4,5',
        method: 'GET',
      });
    });
    describe('no match with peer (null common)', () => {
      beforeEach(() => {
        transportModule.enqueueResponse('getFromPeer', Promise.resolve({ body: { common: null } }));
      });
      it('should check consensus', async () => {
        appState.stubs.getComputed.returns(true);
        blocksChain.enqueueResponse('recoverChain', Promise.resolve());
        await inst.getCommonBlock({ peer: 'peer' } as any, 10);

        expect(appState.stubs.getComputed.called).is.true;
        expect(appState.stubs.getComputed.firstCall.args[0]).is.eq('node.poorConsensus');
      });
      it('should call recoverChain if consensus is low', async () => {
        appState.stubs.getComputed.returns(true);
        blocksChain.enqueueResponse('recoverChain', Promise.resolve());
        await inst.getCommonBlock({ peer: 'peer' } as any, 10);

        expect(blocksChain.stubs.recoverChain.calledOnce).is.true;
      });
      it('should throw error if consensus is adeguate', async () => {
        appState.stubs.getComputed.returns(false);
        await expect(inst.getCommonBlock({ peer: 'peer' } as any, 10)).to
          .be.rejectedWith('Chain comparison failed');
      });
    });
    it('should validate schema agains peer response');
    it('should check response against db to avoid malicious peers');
    it('should trigger recoverChain if returned commonblock does not return anything from db and poor consensus');
    it('should throw error if returned commonblock does not return anything from db and poor consensus');
  });

  describe('loadBlocksOffset', () => {

  });

  describe('loadBlocksFromPeer', () => {

  });

  describe('generateBlock', () => {
  });

  describe('onReceiveBlock', () => {
  });

});
