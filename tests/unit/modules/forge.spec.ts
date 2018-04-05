import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import { SinonFakeTimers, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { catchToLoggerAndRemapError, constants } from '../../../src/helpers';
import { ForgeModule } from '../../../src/modules';
import {
  AccountsModuleStub,
  AppStateStub,
  BlocksModuleStub,
  BlocksSubmoduleProcessStub,
  BroadcasterLogicStub,
  DelegatesModuleStub,
  EdStub,
  JobsQueueStub,
  LoggerStub, SequenceStub,
  SlotsStub,
  TransactionsModuleStub
} from '../../stubs';
import { CreateHashSpy } from '../../stubs/utils/CreateHashSpy';

chai.use(chaiAsPromised);
const rewiredForgeModule = rewire('../../../src/modules/forge');

// tslint:disable no-unused-expression
describe('modules/forge', () => {
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;
  let instance: any;
  let fakeConfig: any;
  let jobsQueueStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let edStub: EdStub;
  let sequenceStub: { addAndPromise: SinonSpy };
  let slotsStub: SlotsStub;
  let appStateStub: AppStateStub;
  let broadcasterLogicStub: BroadcasterLogicStub;
  let accountsModuleStub: AccountsModuleStub;
  let blocksModuleStub: BlocksModuleStub;
  let delegatesModuleStub: DelegatesModuleStub;
  let transactionsModuleStub: TransactionsModuleStub;
  let blocksProcessModuleStub: BlocksSubmoduleProcessStub;

  let createHashSpy: CreateHashSpy;
  let loadKeypairs: () => void;

  beforeEach(() => {
    sandbox    = sinon.sandbox.create();
    clock      = sandbox.useFakeTimers();
    fakeConfig = { forging: { secret: ['secret1', 'secret2'] } };

    jobsQueueStub           = new JobsQueueStub();
    loggerStub              = new LoggerStub();
    edStub                  = new EdStub();
    slotsStub               = new SlotsStub();
    appStateStub            = new AppStateStub();
    broadcasterLogicStub    = new BroadcasterLogicStub();
    accountsModuleStub      = new AccountsModuleStub();
    blocksModuleStub        = new BlocksModuleStub();
    delegatesModuleStub     = new DelegatesModuleStub();
    transactionsModuleStub  = new TransactionsModuleStub();
    blocksProcessModuleStub = new BlocksSubmoduleProcessStub();
    sequenceStub            = {
      addAndPromise: sandbox.spy((w) => {
        return Promise.resolve(
          w()
        );
      }),
    };

    instance = new rewiredForgeModule.ForgeModule();
    instance = instance as any;

    instance.enabledKeys         = {};
    instance.config              = fakeConfig;
    instance.constants           = constants;
    instance.jobsQueue           = jobsQueueStub;
    instance.logger              = loggerStub;
    instance.ed                  = edStub;
    instance.defaultSequence     = sequenceStub;
    instance.slots               = slotsStub;
    instance.appState            = appStateStub;
    instance.broadcasterLogic    = broadcasterLogicStub;
    instance.accountsModule      = accountsModuleStub;
    instance.blocksModule        = blocksModuleStub;
    instance.delegatesModule     = delegatesModuleStub;
    instance.transactionsModule  = transactionsModuleStub;
    instance.blocksProcessModule = blocksProcessModuleStub;

    const crypto               = rewiredForgeModule.__get__('crypto');
    createHashSpy              = new CreateHashSpy(crypto, sandbox);
    blocksModuleStub.lastBlock = {
      height              : 12422,
      id                  : 'blockID',
      blockSignature      : 'blockSignature',
      version             : 1,
      totalAmount         : 0,
      totalFee            : 0,
      reward              : 15,
      payloadHash         : '',
      timestamp           : Date.now(),
      numberOfTransactions: 0,
      payloadLength       : 0,
      previousBlock       : 'previous',
      generatorPublicKey  : 'pubKey',
    };
    loadKeypairs               = () => {
      instance.enabledKeys = {
        aaaa: true,
        bbbb: true,
        cccc: true,
      };
      instance.keypairs    = {
        aaaa: { publicKey: Buffer.from('aaaa', 'hex') },
        bbbb: { publicKey: Buffer.from('bbbb', 'hex') },
        cccc: { publicKey: Buffer.from('cccc', 'hex') },
      };
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
      };
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
        instance.enabledKeys[pk] = false;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[pk];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });

    describe('when passed an object', () => {
      const hex = 'abcdef123456abcdef1234567891011123';
      const pk  = {
        publicKey : Buffer.from(hex, 'hex'),
        privateKey: Buffer.from('aaaa', 'hex'),
      };

      it('should store the keypair in this.keypairs', () => {
        instance.isForgeEnabledOn(pk);
        expect(instance.keypairs[hex]).to.be.deep.equal(pk);
      });

      it('should return true if the public key is enabled', () => {
        instance.enabledKeys[hex] = true;
        expect(instance.isForgeEnabledOn(pk)).to.be.true;
      });

      it('should return false if the public key is NOT enabled', () => {
        instance.enabledKeys[hex] = false;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[hex];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });
  });

  describe('enableForge', () => {
    beforeEach(() => {
      instance.enabledKeys = {
        aaaa: false,
        bbbb: false,
        cccc: true,
      };
      instance.keypairs    = {
        aaaa: {},
        bbbb: {},
        cccc: {},
      };
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
      expect(instance.keypairs.dddd).to.be.deep.equal(kp);
    });
  });

  describe('disableForge', () => {
    beforeEach(() => {
      instance.enabledKeys = {
        bbbb: true,
        cccc: true,
      };
      instance.keypairs    = {
        bbbb: {},
        cccc: {},
      };
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
    // We cannot use rewire here due to incompatibility with FakeTimers.
    let inst: ForgeModule;
    let forgeStub: SinonStub;
    beforeEach(() => {
      jobsQueueStub.stubs.register.resolves();
      transactionsModuleStub.stubs.fillPool.resolves();
      inst = new ForgeModule();
      inst.defaultSequence = new SequenceStub() as any;
      // Immediately execute the jobsQueue Job for testing it
      jobsQueueStub.stubs.register.callsFake((k, t) => {
        t();
      });
      (inst as any).jobsQueue = jobsQueueStub;
      (inst as any).transactionsModule = transactionsModuleStub;
      (inst as any).logger = loggerStub;
      forgeStub = sandbox.stub(inst as any, 'forge');
    });

    it('should call jobsQueue.register after 10 seconds', async () => {
      const p = inst.onBlockchainReady();
      expect(jobsQueueStub.stubs.register.notCalled).to.be.true;
      clock.tick(10100);
      await p;
      expect(jobsQueueStub.stubs.register.called).to.be.true;
      expect(jobsQueueStub.stubs.register.firstCall.args[0]).to.be.equal('delegatesNextForge');
      expect(jobsQueueStub.stubs.register.firstCall.args[1]).to.be.a('function');
      expect(jobsQueueStub.stubs.register.firstCall.args[2]).to.be.equal(1000);
    });

    it('should call transactionsModule.fillPool in scheduled job', async () => {
      const p = inst.onBlockchainReady();
      clock.tick(10100);
      await p;
      expect(transactionsModuleStub.stubs.fillPool.calledOnce).to.be.true;
    });

    it('should call this.forge in scheduled job', async () => {
      const p = inst.onBlockchainReady();
      clock.tick(10100);
      await p;
      expect(forgeStub.calledOnce).to.be.true;
    });

    it('should call logger.warn in scheduled job if transactionsModule.fillPool throws', async () => {
      const expectedError = new Error('err');
      transactionsModuleStub.stubs.fillPool.throws(expectedError);
      const p = inst.onBlockchainReady();
      clock.tick(10100);
      await p;
      expect(forgeStub.notCalled).to.be.true;
      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Error in nextForge');
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.deep.equal(expectedError);
    });

    it('should call logger.warn in scheduled job if this.forge throws', async () => {
      const expectedError = new Error('err');
      forgeStub.throws(expectedError);
      const p = inst.onBlockchainReady();
      clock.tick(500000);
      await p;
      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Error in nextForge');
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.deep.equal(expectedError);
    });
  });

  describe('forge', () => {
    let loadDelegatesStub: SinonStub;
    beforeEach(() => {
      // We stub instance.loadDelegates to assert that function returns
      loadDelegatesStub = sandbox.stub(instance as any, 'loadDelegates');
    });

    describe('When not ready to forge', () => {
      it('should call appState.get', async () => {
        appStateStub.enqueueResponse('get', true);
        await instance.forge();
        expect(appStateStub.stubs.get.calledOnce).to.be.true;
        expect(appStateStub.stubs.get.firstCall.args[0]).to.be.equal('loader.isSyncing');

        appStateStub.reset();
        appStateStub.enqueueResponse('get', false);
        appStateStub.enqueueResponse('get', false);
        await instance.forge();
        expect(appStateStub.stubs.get.calledTwice).to.be.true;
        expect(appStateStub.stubs.get.firstCall.args[0]).to.be.equal('loader.isSyncing');
        expect(appStateStub.stubs.get.secondCall.args[0]).to.be.equal('rounds.isLoaded');

        appStateStub.reset();
        appStateStub.enqueueResponse('get', false);
        appStateStub.enqueueResponse('get', true);
        appStateStub.enqueueResponse('get', true);
        await instance.forge();
        expect(appStateStub.stubs.get.calledThrice).to.be.true;
        expect(appStateStub.stubs.get.firstCall.args[0]).to.be.equal('loader.isSyncing');
        expect(appStateStub.stubs.get.secondCall.args[0]).to.be.equal('rounds.isLoaded');
        expect(appStateStub.stubs.get.thirdCall.args[0]).to.be.equal('rounds.isTicking');
      });

      it('should call logger.debug and return if loader.isSyncing', async () => {
        appStateStub.enqueueResponse('get', true);
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Client not ready to forge');
        expect(loadDelegatesStub.notCalled).to.be.true;
      });

      it('should call logger.debug and return if rounds is not loaded', async () => {
        appStateStub.enqueueResponse('get', false);
        appStateStub.enqueueResponse('get', false);
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Client not ready to forge');
        expect(loadDelegatesStub.notCalled).to.be.true;
      });

      it('should call logger.debug and return if rounds is ticking', async () => {
        appStateStub.enqueueResponse('get', false);
        appStateStub.enqueueResponse('get', true);
        appStateStub.enqueueResponse('get', true);
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Client not ready to forge');
        expect(loadDelegatesStub.notCalled).to.be.true;
      });
    });

    describe('When no delegates are loaded or no delegates at all', () => {
      beforeEach(() => {
        appStateStub.enqueueResponse('get', false); // loader.isSyncing
        appStateStub.enqueueResponse('get', true);  // rounds.isLoaded
        appStateStub.enqueueResponse('get', false); // rounds.isTicking
      });

      it('should call loadDelegates if keypairs is empty', async () => {
        instance.keypairs = {};
        await instance.forge();
        expect(loadDelegatesStub.calledOnce).to.be.true;
      });

      it('should call logger.debug and return if still no delegates after loadDelegates call', async () => {
        instance.keypairs = {};
        // loadDelegates is stubbed and doesn't modify the keypairs object
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('No delegates enabled');
      });
    });

    describe('When waiting for next delegate slot', () => {
      let getBlockSlotDataStub: SinonStub;
      beforeEach(() => {
        appStateStub.enqueueResponse('get', false); // loader.isSyncing
        appStateStub.enqueueResponse('get', true);  // rounds.isLoaded
        appStateStub.enqueueResponse('get', false); // rounds.isTicking
        loadKeypairs();
        slotsStub.enqueueResponse('getSlotNumber', 100);
        slotsStub.enqueueResponse('getSlotNumber', 100);
        // we stub getBlockSlotDataStub to assert that function returns
        getBlockSlotDataStub = sandbox.stub(instance, 'getBlockSlotData');
      });

      it('should call slots.getSlotNumber twice', async () => {
        await instance.forge();
        expect(slotsStub.stubs.getSlotNumber.calledTwice).to.be.true;
        expect(slotsStub.stubs.getSlotNumber.firstCall.args.length).to.be.equal(0);
        expect(slotsStub.stubs.getSlotNumber.secondCall.args[0]).to.be.equal(blocksModuleStub.lastBlock.timestamp);
      });

      it('should call logger.debug and return if currentSlot is the same of last Block', async () => {
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Waiting for next delegate slot');
        expect(getBlockSlotDataStub.notCalled).to.be.true;
      });
    });

    describe('When skipping slots or no blockData', () => {
      let getBlockSlotDataStub: SinonStub;
      beforeEach(() => {
        appStateStub.enqueueResponse('get', false); // loader.isSyncing
        appStateStub.enqueueResponse('get', true);  // rounds.isLoaded
        appStateStub.enqueueResponse('get', false); // rounds.isTicking
        loadKeypairs();
        // currentSlot must not be the same slot of lastBlock => This will pass
        slotsStub.enqueueResponse('getSlotNumber', 97);
        slotsStub.enqueueResponse('getSlotNumber', 98);
        // currentSlot must have the same slotNumber of blockData => This will get catched
        slotsStub.enqueueResponse('getSlotNumber', 99);
        slotsStub.enqueueResponse('getSlotNumber', 100);
        slotsStub.enqueueResponse('getSlotNumber', 100);
        getBlockSlotDataStub = sandbox.stub(instance, 'getBlockSlotData').resolves({ time: 11111 });
      });

      it('should call getBlockSlotData', async () => {
        await instance.forge();
        expect(getBlockSlotDataStub.calledOnce).to.be.true;
        expect(getBlockSlotDataStub.firstCall.args[0]).to.be.equal(97);
        expect(getBlockSlotDataStub.firstCall.args[1]).to.be.equal(blocksModuleStub.lastBlock.height + 1);
      });

      it('should call logger.warn and return if getBlockSlotData returns null', async () => {
        getBlockSlotDataStub.resolves(null);
        await instance.forge();
        expect(loggerStub.stubs.warn.calledOnce).to.be.true;
        expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Skipping delegate slot');
        // Called twice means that function returns
        expect(slotsStub.stubs.getSlotNumber.calledTwice).to.be.true;
      });

      it('should call slots.getSlotNumber five times', async () => {
        await instance.forge();
        expect(slotsStub.stubs.getSlotNumber.callCount).to.be.equal(5);
        expect(slotsStub.stubs.getSlotNumber.getCall(0).args.length).to.be.equal(0);
        expect(slotsStub.stubs.getSlotNumber.getCall(1).args.length).to.be.equal(1);
        expect(slotsStub.stubs.getSlotNumber.getCall(1).args[0]).to.be.equal(blocksModuleStub.lastBlock.timestamp);
        expect(slotsStub.stubs.getSlotNumber.getCall(2).args.length).to.be.equal(1);
        expect(slotsStub.stubs.getSlotNumber.getCall(2).args[0]).to.be.equal(11111);
        expect(slotsStub.stubs.getSlotNumber.getCall(3).args.length).to.be.equal(0);
        expect(slotsStub.stubs.getSlotNumber.getCall(4).args.length).to.be.equal(0);
      });

      it('should call logger.debug and return if not current slot', async () => {
        await instance.forge();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Delegate slot 100');
        expect(sequenceStub.addAndPromise.notCalled).to.be.true;
      });
    });

    describe('When OK', () => {
      let getBlockSlotDataStub: SinonStub;
      let catcherStub: SinonStub;
      let catcherLastErr: any;
      beforeEach(() => {
        appStateStub.enqueueResponse('get', false); // loader.isSyncing
        appStateStub.enqueueResponse('get', true);  // rounds.isLoaded
        appStateStub.enqueueResponse('get', false); // rounds.isTicking
        appStateStub.enqueueResponse('get', 10); // node.consensus
        appStateStub.enqueueResponse('getComputed', false); // node.poorConsensus
        loadKeypairs();
        // currentSlot must not be the same slot of lastBlock => This will pass
        slotsStub.enqueueResponse('getSlotNumber', 97);
        slotsStub.enqueueResponse('getSlotNumber', 98);
        // currentSlot must have the same slotNumber of blockData => This will get catched
        slotsStub.enqueueResponse('getSlotNumber', 100);
        slotsStub.enqueueResponse('getSlotNumber', 100);
        getBlockSlotDataStub = sandbox.stub(instance, 'getBlockSlotData').resolves({ time: 11111, keypair: {} });
        broadcasterLogicStub.enqueueResponse('getPeers', Promise.resolve());
        blocksProcessModuleStub.enqueueResponse('generateBlock', Promise.resolve());
        const helpers = rewiredForgeModule.__get__('helpers_1');
        catcherStub   = sandbox.stub(helpers, 'catchToLoggerAndRemapError');
        catcherStub.callsFake((rejectString) => {
          return (err: Error) => {
            catcherLastErr = err;
            return Promise.reject(rejectString);
          };
        });
        catcherLastErr = null;
      });

      // it('should call sequence.addAndPromise', async () => {
      //   await instance.forge();
      //   expect(sequenceStub.addAndPromise.calledOnce).to.be.true;
      // });

      it('should call broadcasterLogic.getPeers (in sequence worker)', async () => {
        await instance.forge();
        expect(broadcasterLogicStub.stubs.getPeers.calledOnce).to.be.true;
        expect(broadcasterLogicStub.stubs.getPeers.firstCall.args[0]).to.be.deep.equal({ limit: constants.maxPeers });
      });

      it('should call appState.getComputed (in sequence worker)', async () => {
        await instance.forge();
        expect(appStateStub.stubs.getComputed.calledOnce).to.be.true;
        expect(appStateStub.stubs.getComputed.firstCall.args[0]).to.be.equal('node.poorConsensus');
      });

      it('should throw if node has poor consensus (in sequence worker)', async () => {
        appStateStub.stubs.getComputed.returns(true);
        await expect(instance.forge()).to.be.rejectedWith('Inadequate broadhash consensus 10 %');
      });

      it('should call blocksProcessModule.generateBlock (in sequence worker)', async () => {
        await instance.forge();
        expect(blocksProcessModuleStub.stubs.generateBlock.calledOnce).to.be.true;
        expect(blocksProcessModuleStub.stubs.generateBlock.firstCall.args[0]).to.be.deep.equal({});
        expect(blocksProcessModuleStub.stubs.generateBlock.firstCall.args[1]).to.be.equal(11111);
      });

      it('should call catchToLoggerAndRemapError if addAndPromise promise is rejected', async () => {
        blocksProcessModuleStub.stubs.generateBlock.rejects(new Error('hey'));
        await expect(instance.forge()).to.be.rejectedWith('Failed to generate block within delegate slot');
        expect(catcherStub.calledOnce).to.be.true;
      });
    });
  });

  describe('loadDelegates', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.getAccount.callsFake((filter) => {
        return {
          address   : 'addr_' + filter.publicKey,
          publicKey : filter.publicKey,
          isDelegate: true,
        };
      });
      edStub.stubs.makeKeypair.callsFake((hash) => {
        return {
          privateKey: 'pr' + hash.toString('hex'),
          publicKey : 'pu' + hash.toString('hex'),
        };
      });
    });

    it('should return if no forging.secret or empty forging.secret', async () => {
      fakeConfig.forging.secret = false;
      await instance.loadDelegates();
      expect(loggerStub.stubs.info.notCalled).to.be.true;
      fakeConfig.forging.secret = [];
      await instance.loadDelegates();
      expect(loggerStub.stubs.info.notCalled).to.be.true;
    });

    it('should call logger.info', async () => {
      await instance.loadDelegates();
      expect(loggerStub.stubs.info.callCount).to.be.equal(3);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Loading 2 delegates from config');
    });

    it('should call crypto.createhash(sha256).update.digest', async () => {
      await instance.loadDelegates();
      expect(createHashSpy.callCount).to.be.equal(2);
      expect(createHashSpy.spies.update[0].firstCall.args[0]).to.be.equal('secret1');
      expect(createHashSpy.spies.update[1].firstCall.args[0]).to.be.equal('secret2');
    });

    it('should call ed.makeKeypair with the hash', async () => {
      await instance.loadDelegates();
      expect(edStub.stubs.makeKeypair.callCount).to.be.equal(2);
      expect(edStub.stubs.makeKeypair.firstCall.args[0]).to.be.deep.
        equal(createHashSpy.spies.digest[0].firstCall.returnValue);
      expect(edStub.stubs.makeKeypair.secondCall.args[0]).to.be.deep.
        equal(createHashSpy.spies.digest[1].firstCall.returnValue);
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.loadDelegates();
      expect(accountsModuleStub.stubs.getAccount.callCount).to.be.equal(2);
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({
        publicKey: 'pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
      });
      expect(accountsModuleStub.stubs.getAccount.secondCall.args[0]).to.be.deep.equal({
        publicKey: 'pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
      });
    });

    it('should throw if account not found', async () => {
      accountsModuleStub.stubs.getAccount.resolves(false);
      const e = 'Account with publicKey: pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6 not found';
      await expect(instance.loadDelegates()).to.be.rejectedWith(e);
    });

    it('should add the keypair to this.keypairs if account is a delegate', async () => {
      await instance.loadDelegates();
      expect(instance.keypairs).to.be.deep.equal({
          pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6:
            {
              privateKey: 'pr5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
              publicKey : 'pu5b11618c2e44027877d0cd0921ed166b9f176f50587fc91e7534dd2946db77d6',
            },
          pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2:
            {
              privateKey: 'pr35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
              publicKey : 'pu35224d0d3465d74e855f8d69a136e79c744ea35a675d3393360a327cbf6359a2',
            },
        }
      );
    });

    it('should call logger.info if account is a delegate', async () => {
      await instance.loadDelegates();
      expect(loggerStub.stubs.info.callCount).to.be.equal(3);
      expect(loggerStub.stubs.info.getCall(1).args[0]).to.match(/Forging enabled on account addr_pu5b11618c2e/);
      expect(loggerStub.stubs.info.getCall(2).args[0]).to.match(/Forging enabled on account addr_pu35224d0d34/);
    });

    it('should call logger.warn if account is NOT a delegate', async () => {
      accountsModuleStub.stubs.getAccount.returns({publicKey: 'a', isDelegate: false});
      await instance.loadDelegates();
      expect(loggerStub.stubs.warn.callCount).to.be.equal(2);
      expect(loggerStub.stubs.warn.getCall(0).args[0]).to.be.equal('Account with public Key: a is not a delegate');
      expect(loggerStub.stubs.warn.getCall(1).args[0]).to.be.equal('Account with public Key: a is not a delegate');
    });

    it('should call this.enableForge', async () => {
      const enableForgeStub = sandbox.stub(instance, 'enableForge');
      await instance.loadDelegates();
      expect(enableForgeStub.calledOnce).to.be.true;
    });
  });

  describe('getBlockSlotData', () => {
    const delegates = {
      puk1: {publicKey: 'puk1', privateKey: 'prk1'},
      puk2: {publicKey: 'puk2', privateKey: 'prk2'},
    };

    beforeEach(() => {
      delegatesModuleStub.enqueueResponse('generateDelegateList', Object.keys(delegates));
      slotsStub.enqueueResponse('getLastSlot', 2);
      slotsStub.enqueueResponse('getSlotTime', 1000);
    });

    it('should call delegatesModule.generateDelegateList', async () => {
      await instance.getBlockSlotData(0, 12345);
      expect(delegatesModuleStub.stubs.generateDelegateList.calledOnce).to.be.true;
      expect(delegatesModuleStub.stubs.generateDelegateList.firstCall.args[0]).to.be.equal(12345);
    });

    it('should call slots.getLastSlot', async () => {
      await instance.getBlockSlotData(0, 12345);
      expect(slotsStub.stubs.getLastSlot.calledOnce).to.be.true;
      expect(slotsStub.stubs.getLastSlot.firstCall.args[0]).to.be.equal(0);
    });

    describe('if a valid delegate is found in the list and it is enabled to forge', () => {
      beforeEach(() => {
        instance.enabledKeys.puk2 = true;
        instance.keypairs.puk2 = delegates.puk2;
      });

      it('should call slots.getSlotTime for the slot corresponding to the enabled delegate', async () => {
        await instance.getBlockSlotData(0, 12345);
        expect(slotsStub.stubs.getSlotTime.callCount).to.be.eq(1);
        expect(slotsStub.stubs.getSlotTime.firstCall.args[0]).to.be.equal(1);
      });

      it('should return an object with keypair and slotTime', async () => {
        const retVal = await instance.getBlockSlotData(0, 12345);
        expect(retVal).to.be.deep.eq({
          keypair: delegates.puk2,
          time: 1000,
        });
      });
    });

    describe('else', () => {
      it('should return null', async () => {
        const retVal = await instance.getBlockSlotData(0, 12345);
        expect(retVal).to.be.null;
      });

      it('should NOT call slots.getSlotTime', async () => {
        await instance.getBlockSlotData(0, 12345);
        expect(slotsStub.stubs.getSlotTime.notCalled).to.be.true;
      });
    });
  });
});
