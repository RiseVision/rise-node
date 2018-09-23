import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonFakeTimers, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { AppState, JobsQueue } from '../../../core-helpers/src';
import { ICrypto, ILogger } from '../../../core-interfaces/src/helpers';
import { dPoSSymbols, Slots } from '../../src/helpers';
import { BroadcasterLogic } from '../../../core-p2p/src/broadcaster';
import { IAccountsModule, IBlocksModule, ITransactionsModule } from '../../../core-interfaces/src/modules';
import { DelegatesModule, ForgeModule } from '../../src/modules';
import { BlocksModuleProcess } from '../../../core-blocks/src/modules';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../../core-interfaces/src';
import { BlocksSymbols } from '../../../core-blocks/src';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { IBlocksModel } from '../../../core-interfaces/src/models';
import { LiskWallet } from 'dpos-offline';
import { ConstantsType } from '../../../core-types/src';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/forge', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: ForgeModule;
  let fakeConfig: any;
  let jobsQueueStub: JobsQueue;
  let edStub: ICrypto;
  let sequenceStub: { addAndPromise: SinonSpy };
  let slotsStub: Slots;
  let appStateStub: AppState;
  let broadcasterLogicStub: BroadcasterLogic;
  let accountsModuleStub: IAccountsModule;
  let blocksModuleStub: IBlocksModule;
  let delegatesModuleStub: DelegatesModule;
  let transactionsModuleStub: ITransactionsModule;
  let blocksProcessModuleStub: BlocksModuleProcess;
  let logger: ILogger;
  let blocksModel: typeof IBlocksModel;
  let constants: ConstantsType;

  let loadKeypairs: () => void;
  before(async () => {
    sandbox    = sinon.createSandbox();
  });
  beforeEach(async () => {
    container  = await createContainer(['core-consensus-dpos', 'core-helpers', 'core']);
    fakeConfig = { forging: { secret: ['secret1', 'secret2'] } };
    container.get<any>(Symbols.generic.appConfig).forging = fakeConfig.forging;
    logger                     = container.get(Symbols.helpers.logger);
    constants                  = container.get(Symbols.generic.constants);
    jobsQueueStub              = container.get(Symbols.helpers.jobsQueue);
    edStub                     = container.get(Symbols.generic.crypto);
    slotsStub                  = container.get(dPoSSymbols.helpers.slots);
    appStateStub               = container.get(Symbols.logic.appState);
    broadcasterLogicStub       = container.get(Symbols.logic.broadcaster);
    accountsModuleStub         = container.get(Symbols.modules.accounts);
    blocksModuleStub           = container.get(Symbols.modules.blocks);
    delegatesModuleStub        = container.get(dPoSSymbols.modules.delegates);
    transactionsModuleStub     = container.get(Symbols.modules.transactions);
    blocksProcessModuleStub    = container.get(BlocksSymbols.modules.process);
    blocksModel                = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    instance                   = container.get(dPoSSymbols.modules.forge);
    sequenceStub               = {
      addAndPromise: sandbox.spy((w) => {
        return Promise.resolve(
          w()
        );
      }),
    };
    blocksModuleStub.lastBlock = new blocksModel({
      blockSignature      : Buffer.from('blockSignature'),
      generatorPublicKey  : Buffer.from('pubKey'),
      height              : 12422,
      id                  : 'blockID',
      numberOfTransactions: 0,
      payloadHash         : Buffer.from('payload'),
      payloadLength       : 0,
      previousBlock       : 'previous',
      reward              : 15,
      timestamp           : Date.now(),
      totalAmount         : 0,
      totalFee            : 0,
      version             : 1,
    });
    loadKeypairs               = () => {
      instance.enabledKeys = {
        aaaa: true,
        bbbb: true,
        cccc: true,
      };
      instance['keypairs'] = {
        aaaa: { publicKey: Buffer.from('aaaa', 'hex') },
        bbbb: { publicKey: Buffer.from('bbbb', 'hex') },
        cccc: { publicKey: Buffer.from('cccc', 'hex') },
      } as any;
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getEnabledKeys', () => {
    it('should return an object with all enabled keys and omit those set to false', () => {
      instance.enabledKeys = {
        key1: true,
        key2: false,
        key3: true,
      } as any;
      const retVal         = instance.getEnabledKeys();
      expect(retVal).to.be.deep.equal(['key1', 'key3']);
    });
  });

  describe('isForgeEnabledOn', () => {
    describe('when passed a string', () => {
      const pk = 'abcdef123456abcdef1234567891011123';
      it('should return true if this.enabledKeys[pk] is true', () => {
        instance.enabledKeys[pk] = true;
        expect(instance.isForgeEnabledOn(pk)).to.be.true;
      });

      it('should return false if this.enabledKeys[pk] is false or not set', () => {
        instance.enabledKeys[pk] = false as any;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[pk];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });

    describe('when passed an object', () => {
      const hex = 'abcdef123456abcdef1234567891011123';
      const pk  = {
        privateKey: Buffer.from('aaaa', 'hex'),
        publicKey : Buffer.from(hex, 'hex'),
      };

      it('should store the keypair in this.keypairs', () => {
        instance.isForgeEnabledOn(pk);
        expect(instance['keypairs'][hex]).to.be.deep.equal(pk);
      });

      it('should return true if the public key is enabled', () => {
        instance.enabledKeys[hex] = true;
        expect(instance.isForgeEnabledOn(pk)).to.be.true;
      });

      it('should return false if the public key is NOT enabled', () => {
        instance.enabledKeys[hex] = false as any;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[hex];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });
  });

  describe('enableForge', () => {
    beforeEach(() => {
      instance['enabledKeys'] = {
        aaaa: false,
        bbbb: false,
        cccc: true,
      } as any;
      instance['keypairs']    = {
        aaaa: {},
        bbbb: {},
        cccc: {},
      } as any;
    });

    it('should set all enabledKeys to true if no keypair is passed', () => {
      instance.enableForge();
      expect(instance.enabledKeys).to.be.deep.equal({
        aaaa: true,
        bbbb: true,
        cccc: true,
      });
    });

    it('should set the passed key to true in enabledKeys', () => {
      instance.enableForge({ publicKey: Buffer.from('bbbb', 'hex'), privateKey: Buffer.from('0') });
      expect(instance.enabledKeys).to.be.deep.equal({
        aaaa: false,
        bbbb: true,
        cccc: true,
      });
    });

    it('should store the passed key in keypairs', () => {
      const kp = { publicKey: Buffer.from('dddd', 'hex'), privateKey: Buffer.from('0') };
      instance.enableForge(kp);
      expect(instance['keypairs'].dddd).to.be.deep.equal(kp);
    });
  });

  describe('disableForge', () => {
    beforeEach(() => {
      instance.enabledKeys = {
        bbbb: true,
        cccc: true,
      };
      instance['keypairs'] = {
        bbbb: {},
        cccc: {},
      } as any;
    });

    it('should delete all enabledKeys if no keypair is passed', () => {
      instance.disableForge();
      expect(instance.enabledKeys).to.be.deep.equal({});
    });

    it('should delete the passed key from enabledKeys', () => {
      instance.disableForge('bbbb');
      expect(instance.enabledKeys).to.be.deep.equal({
        cccc: true,
      });
    });
  });

  describe('onBlockchainReady', () => {
    let forgeStub: SinonStub;
    let jobsRegister: SinonStub;
    let loggerWarnStub: SinonStub;
    let clock: SinonFakeTimers;
    beforeEach(() => {
      clock      = sandbox.useFakeTimers();

      loggerWarnStub = sandbox.stub(logger, 'warn').returns(null);

      // Immediately execute the jobsQueue Job for testing it
      jobsRegister = sandbox.stub(jobsQueueStub, 'register').callsFake((k, t) => {
        t();
      });
      forgeStub                        = sandbox.stub(instance as any, 'forge');
    });

    it('should call jobsQueue.register after 10 seconds', async () => {
      const p = instance.onBlockchainReady();
      expect(jobsRegister.notCalled).to.be.true;
      clock.tick(10100);
      await p;
      expect(jobsRegister.called).to.be.true;
      expect(jobsRegister.firstCall.args[0]).to.be.equal('delegatesNextForge');
      expect(jobsRegister.firstCall.args[1]).to.be.a('function');
      expect(jobsRegister.firstCall.args[2]).to.be.equal(1000);
    });

    // it('should call transactionsModule.fillPool in scheduled job', async () => {
    //   const p = instance.onBlockchainReady();
    //   clock.tick(10100);
    //   await p;
    //   expect(fillPoolStub.calledOnce).to.be.true;
    // });

    it('should call this.forge in scheduled job', async () => {
      const p = instance.onBlockchainReady();
      clock.tick(10100);
      await p;
      expect(forgeStub.calledOnce).to.be.true;
    });

    // it('should call logger.warn in scheduled job if transactionsModule.fillPool throws', async () => {
    //   const expectedError = new Error('err');
    //   fillPoolStub.throws(expectedError);
    //   const p = instance.onBlockchainReady();
    //   clock.tick(10100);
    //   await p;
    //   expect(forgeStub.notCalled).to.be.true;
    //   expect(loggerWarnStub.calledOnce).to.be.true;
    //   expect(loggerWarnStub.firstCall.args[0]).to.be.equal('Error in nextForge');
    //   expect(loggerWarnStub.firstCall.args[1]).to.be.deep.equal(expectedError);
    // });

    it('should call logger.warn in scheduled job if this.forge throws', async () => {
      const expectedError = new Error('err');
      forgeStub.throws(expectedError);
      const p = instance.onBlockchainReady();
      clock.tick(500000);
      await p;
      expect(loggerWarnStub.calledOnce).to.be.true;
      expect(loggerWarnStub.firstCall.args[0]).to.be.equal('Error in nextForge');
      expect(loggerWarnStub.firstCall.args[1]).to.be.deep.equal(expectedError);
    });
  });

  describe('forge', () => {
    let loadDelegatesStub: SinonStub;
    let appStateGetStub: SinonStub;
    let getBlockSlotDataStub: SinonStub;

    beforeEach(() => {
      // We stub instance['loadDelegates'] to assert that function returns
      loadDelegatesStub = sandbox.stub(instance as any, 'loadDelegates');
      appStateGetStub   = sandbox.stub(appStateStub, 'get');
      getBlockSlotDataStub = sandbox.stub(instance as any, 'getBlockSlotData').resolves({ time: 11111, keypair: {} });
    });

    describe('When not ready to forge', () => {
      it('should call appState.get', async () => {
        appStateGetStub.returns(true);
        await instance['forge']();
        expect(appStateGetStub.calledOnce).to.be.true;
        expect(appStateGetStub.firstCall.args[0]).to.be.equal('loader.isSyncing');
        appStateGetStub.resetHistory();
        appStateGetStub.returns(false);
        await instance['forge']();
        expect(appStateGetStub.calledTwice).to.be.true;
        expect(appStateGetStub.firstCall.args[0]).to.be.equal('loader.isSyncing');

        appStateGetStub.resetHistory();
        appStateGetStub.onFirstCall().returns(false);
        appStateGetStub.returns(true);

        await instance['forge']();
        expect(appStateGetStub.calledTwice).to.be.true;
        expect(appStateGetStub.firstCall.args[0]).to.be.equal('loader.isSyncing');
        expect(appStateGetStub.secondCall.args[0]).to.be.equal('rounds.isTicking');
      });

      it('should call return if rounds is ticking', async () => {
        appStateGetStub.onSecondCall().returns(true);
        await instance['forge']();
        expect(loadDelegatesStub.notCalled).to.be.true;
      });
    });

    describe('When no delegates are loaded or no delegates at all', () => {
      beforeEach(() => {
        appStateGetStub.onFirstCall().returns(false); // loader.isSyncing
        appStateGetStub.onSecondCall().returns(false); // rounds.isTicking
      });

      it('should call loadDelegates if keypairs is empty', async () => {
        instance['keypairs'] = {};
        await instance['forge']();
        expect(loadDelegatesStub.calledOnce).to.be.true;
      });

    });

    describe('When waiting for next delegate slot', () => {
      let getSlotNumberStub: SinonStub;
      beforeEach(() => {
        appStateGetStub.onFirstCall().returns(false); // loader.isSyncing
        appStateGetStub.onSecondCall().returns(false); // rounds.isTicking
        loadKeypairs();
        getSlotNumberStub    = sandbox.stub(slotsStub, 'getSlotNumber').returns(100);
        // we stub getBlockSlotDataStub to assert that function returns
      });

      it('should call slots.getSlotNumber twice', async () => {
        await instance['forge']();
        expect(getSlotNumberStub.calledTwice).to.be.true;
        expect(getSlotNumberStub.firstCall.args.length).to.be.equal(0);
        expect(getSlotNumberStub.secondCall.args[0]).to.be.equal(blocksModuleStub.lastBlock.timestamp);
      });

      it('should return if currentSlot is the same of last Block', async () => {
        await instance['forge']();
        expect(getBlockSlotDataStub.notCalled).to.be.true;
      });
    });

    describe('When skipping slots or no blockData', () => {
      let getSlotNumberStub: SinonStub;

      beforeEach(() => {
        appStateGetStub.onFirstCall().returns(false); // loader.isSyncing
        appStateGetStub.onSecondCall().returns(false); // rounds.isTicking
        loadKeypairs();
        getSlotNumberStub = sandbox.stub(slotsStub, 'getSlotNumber');
        // currentSlot must not be the same slot of lastBlock => This will pass
        getSlotNumberStub.onCall(0).returns(97);
        getSlotNumberStub.onCall(1).returns(98);
        // currentSlot must have the same slotNumber of blockData => This will get catched
        getSlotNumberStub.onCall(2).returns(99);
        getSlotNumberStub.onCall(3).returns(100);
        getSlotNumberStub.onCall(4).returns(100);

      });

      it('should call getBlockSlotData', async () => {
        await instance['forge']();
        expect(getBlockSlotDataStub.calledOnce).to.be.true;
        expect(getBlockSlotDataStub.firstCall.args[0]).to.be.equal(97);
        expect(getBlockSlotDataStub.firstCall.args[1]).to.be.equal(blocksModuleStub.lastBlock.height + 1);
      });

      it('should return if getBlockSlotData returns null', async () => {
        getBlockSlotDataStub.resolves(null);
        await instance['forge']();
        // Called twice means that function returns
        expect(getSlotNumberStub.calledTwice).to.be.true;
      });

      it('should call slots.getSlotNumber five times', async () => {
        await instance['forge']();
        expect(getSlotNumberStub.callCount).to.be.equal(5);
        expect(getSlotNumberStub.getCall(0).args.length).to.be.equal(0);
        expect(getSlotNumberStub.getCall(1).args.length).to.be.equal(1);
        expect(getSlotNumberStub.getCall(1).args[0]).to.be.equal(blocksModuleStub.lastBlock.timestamp);
        expect(getSlotNumberStub.getCall(2).args.length).to.be.equal(1);
        expect(getSlotNumberStub.getCall(2).args[0]).to.be.equal(11111);
        expect(getSlotNumberStub.getCall(3).args.length).to.be.equal(0);
        expect(getSlotNumberStub.getCall(4).args.length).to.be.equal(0);
      });

      it('should call return if not current slot', async () => {
        await instance['forge']();
        expect(sequenceStub.addAndPromise.notCalled).to.be.true;
      });
    });

    describe('When OK', () => {
      let getBlockSlotDataStub: SinonStub;
      let getComputedStub: SinonStub;
      let getSlotNumberStub: SinonStub;
      let getPeersStub: SinonStub;
      let genBlockStub: SinonStub;

      beforeEach(() => {
        appStateGetStub.onFirstCall().returns(false); // loader.isSyncing
        appStateGetStub.onSecondCall().returns(false); // rounds.isTicking
        appStateGetStub.onCall(2).returns(10); // node.consensus
        getComputedStub   = sandbox.stub(appStateStub, 'getComputed').returns(false); // node.poorConsensus
        getSlotNumberStub = sandbox.stub(slotsStub, 'getSlotNumber');
        loadKeypairs();
        // currentSlot must not be the same slot of lastBlock => This will pass
        getSlotNumberStub.onCall(0).returns(97);
        getSlotNumberStub.onCall(1).returns(98);
        // currentSlot must have the same slotNumber of blockData => This will get catched
        getSlotNumberStub.onCall(2).returns(100);
        getSlotNumberStub.onCall(3).returns(100);

        getPeersStub = sandbox.stub(broadcasterLogicStub, 'getPeers').resolves();
        genBlockStub = sandbox.stub(blocksProcessModuleStub, 'generateBlock').resolves();
      });

      it('should call broadcasterLogic.getPeers (in sequence worker)', async () => {
        await instance['forge']();
        expect(getPeersStub.calledOnce).to.be.true;
        expect(getPeersStub.firstCall.args[0]).to.be.deep.equal({ limit: constants.maxPeers });
      });

      it('should call appState.getComputed (in sequence worker)', async () => {
        await instance['forge']();
        expect(getComputedStub.calledOnce).to.be.true;
        expect(getComputedStub.firstCall.args[0]).to.be.equal('node.poorConsensus');
      });

      it('should throw if node has poor consensus (in sequence worker)', async () => {
        getComputedStub.returns(true);
        await expect(instance['forge']()).to.be.rejectedWith('Inadequate broadhash consensus 10 %');
      });

      it('should call blocksProcessModule.generateBlock (in sequence worker)', async () => {
        await instance['forge']();
        expect(genBlockStub.calledOnce).to.be.true;
        expect(genBlockStub.firstCall.args[0]).to.be.deep.equal({});
        expect(genBlockStub.firstCall.args[1]).to.be.equal(11111);
      });

      it('should call catchToLoggerAndRemapError if addAndPromise promise is rejected', async () => {
        genBlockStub.rejects(new Error('hey'));
        await expect(instance['forge']()).to.be.rejectedWith('Failed to generate block within delegate slot');
      });
    });
  });

  describe('loadDelegates', () => {
    let getAccountStub: SinonStub;
    let makeKeyPairStub: SinonStub;
    beforeEach(() => {
      getAccountStub  = sandbox.stub(accountsModuleStub, 'getAccount').callsFake((filter) => {
        return {
          address   : 'addr_' + filter.publicKey,
          isDelegate: true,
          publicKey : filter.publicKey,
        };
      });
      makeKeyPairStub = sandbox.stub(edStub, 'makeKeyPair').callsFake((hash) => {
        return {
          privateKey: 'pr' + hash.toString('hex'),
          publicKey : 'pu' + hash.toString('hex'),
        };
      });
    });

    it('should return if no forging.secret or empty forging.secret', async () => {
      fakeConfig.forging.secret = false;
      await instance['loadDelegates']();
      fakeConfig.forging.secret = [];
      await instance['loadDelegates']();
    });

    it('should call ed.makeKeypair with the hash', async () => {
      await instance['loadDelegates']();
      expect(makeKeyPairStub.callCount).to.be.equal(2);
      expect(makeKeyPairStub.firstCall.args[0].toString('hex')).to.be.deep.equal('5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6');
      expect(makeKeyPairStub.secondCall.args[0].toString('hex')).to.be.deep.equal('35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2');
    });

    it('should call accountsModule.getAccount', async () => {
      await instance['loadDelegates']();
      expect(getAccountStub.callCount).to.be.equal(2);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
        publicKey: 'pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
      });
      expect(getAccountStub.secondCall.args[0]).to.be.deep.equal({
        publicKey: 'pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
      });
    });

    it('should throw if account not found', async () => {
      getAccountStub.resolves(false);
      const e = 'Account with publicKey: pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6 not found';
      await expect(instance['loadDelegates']()).to.be.rejectedWith(e);
    });

    it('should add the keypair to this.keypairs if account is a delegate', async () => {
      let before = {...instance['keypairs']};
      await instance['loadDelegates']();
      expect(instance['keypairs']).to.be.deep.equal({
        ...before,
        pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2:
          {
            privateKey: 'pr35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
            publicKey : 'pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
          },
        pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6:
          {
            privateKey: 'pr5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
            publicKey : 'pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
          },
        }
      );
    });

    it('should call this.enableForge', async () => {
      const enableForgeStub = sandbox.stub(instance, 'enableForge');
      await instance['loadDelegates']();
      expect(enableForgeStub.calledOnce).to.be.true;
    });
  });

  describe('getBlockSlotData', () => {
    const delegates = {
      puk1: {
        publicKey : Buffer.from(new LiskWallet('puk1', 'R').publicKey, 'hex'),
        privateKey: Buffer.from(new LiskWallet('puk1', 'R').privKey, 'hex')
      },
      puk2: {
        publicKey : Buffer.from(new LiskWallet('puk2', 'R').publicKey, 'hex'),
        privateKey: Buffer.from(new LiskWallet('puk1', 'R').privKey, 'hex')
      },
    };

    let generateDelegateListStub: SinonStub;
    let lastSlotStub: SinonStub;
    let getSlotTimeStub: SinonStub;
    beforeEach(() => {
      generateDelegateListStub = sandbox.stub(delegatesModuleStub, 'generateDelegateList')
        .returns(Object.keys(delegates));
      lastSlotStub             = sandbox.stub(slotsStub, 'getLastSlot').returns(2);
      getSlotTimeStub          = sandbox.stub(slotsStub, 'getSlotTime').returns(1000);
    });

    it('should call delegatesModule.generateDelegateList', async () => {
      await instance['getBlockSlotData'](0, 12345);
      expect(generateDelegateListStub.calledOnce).to.be.true;
      expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(12345);
    });

    it('should call slots.getLastSlot', async () => {
      await instance['getBlockSlotData'](0, 12345);
      expect(lastSlotStub.calledOnce).to.be.true;
      expect(lastSlotStub.firstCall.args[0]).to.be.equal(0);
    });

    describe('if a valid delegate is found in the list and it is enabled to forge', () => {
      beforeEach(() => {
        instance.enabledKeys.puk2 = true;
        instance['keypairs'].puk2 = delegates.puk2;
      });

      it('should call slots.getSlotTime for the slot corresponding to the enabled delegate', async () => {
        await instance['getBlockSlotData'](0, 12345);
        expect(getSlotTimeStub.callCount).to.be.eq(1);
        expect(getSlotTimeStub.firstCall.args[0]).to.be.equal(1);
      });

      it('should return an object with keypair and slotTime', async () => {
        const retVal = await instance['getBlockSlotData'](0, 12345);
        expect(retVal).to.be.deep.eq({
          keypair: delegates.puk2,
          time   : 1000,
        });
      });
    });

    describe('else', () => {
      it('should return null', async () => {
        const retVal = await instance['getBlockSlotData'](0, 12345);
        expect(retVal).to.be.null;
      });

      it('should NOT call slots.getSlotTime', async () => {
        await instance['getBlockSlotData'](0, 12345);
        expect(getSlotTimeStub.notCalled).to.be.true;
      });
    });
  });
});
