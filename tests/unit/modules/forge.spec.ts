import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { constants } from '../../../src/helpers';
import { ForgeModule } from '../../../src/modules';

import {
  AccountsModuleStub,
  AppStateStub,
  BlocksModuleStub,
  BlocksSubmoduleProcessStub,
  BroadcasterLogicStub, DelegatesModuleStub,
  EdStub,
  JobsQueueStub,
  LoggerStub,
  SequenceStub,
  SlotsStub,
  TransactionsModuleStub
} from '../../stubs';
import { CreateHashSpy } from '../../stubs/utils/CreateHashSpy';
import { generateAccounts } from '../../utils/accountsUtils';

chai.use(chaiAsPromised);
const rewiredForgeModule = rewire('../../../src/modules/forge');

// tslint:disable no-unused-expression
describe('modules/forge', () => {
  let sandbox: SinonSandbox;
  let instance: ForgeModule;
  let jobsQueueStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let edStub: EdStub;
  let sequenceStub: SequenceStub;
  let slotsStub: SlotsStub;
  let appStateStub: AppStateStub;
  let broadcasterLogicStub: BroadcasterLogicStub;
  let accountsModuleStub: AccountsModuleStub;
  let blocksModuleStub: BlocksModuleStub;
  let delegatesModuleStub: DelegatesModuleStub;
  let transactionsModuleStub: TransactionsModuleStub;
  let blocksProcessModuleStub: BlocksSubmoduleProcessStub;

  let createHashSpy: CreateHashSpy;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    const fakeConfig = { forging: { secret: ['secret1', 'secret2'] } };

    jobsQueueStub           = new JobsQueueStub();
    loggerStub              = new LoggerStub();
    edStub                  = new EdStub();
    sequenceStub            = new SequenceStub();
    slotsStub               = new SlotsStub();
    appStateStub            = new AppStateStub();
    broadcasterLogicStub    = new BroadcasterLogicStub();
    accountsModuleStub      = new AccountsModuleStub();
    blocksModuleStub        = new BlocksModuleStub();
    delegatesModuleStub     = new DelegatesModuleStub();
    transactionsModuleStub  = new TransactionsModuleStub();
    blocksProcessModuleStub = new BlocksSubmoduleProcessStub();

    instance = new rewiredForgeModule.ForgeModule();

    (instance as any).enabledKeys         = {};
    (instance as any).config              = fakeConfig;
    (instance as any).constants           = constants;
    (instance as any).jobsQueue           = jobsQueueStub;
    (instance as any).logger              = loggerStub;
    (instance as any).ed                  = edStub;
    (instance as any).sequence            = sequenceStub;
    (instance as any).slots               = slotsStub;
    (instance as any).appState            = appStateStub;
    (instance as any).broadcasterLogic    = BroadcasterLogicStub;
    (instance as any).accountsModule      = accountsModuleStub;
    (instance as any).blocksModule        = blocksModuleStub;
    (instance as any).delegatesModule     = delegatesModuleStub;
    (instance as any).transactionsModule  = transactionsModuleStub;
    (instance as any).blocksProcessModule = blocksProcessModuleStub;

    const crypto  = rewiredForgeModule.__get__('crypto');
    createHashSpy = new CreateHashSpy(crypto, sandbox);
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  describe('getEnabledKeys', () => {
    it('should return an object with all enabled keys and omit those set to false', () => {
      (instance as any).enabledKeys = {
        key1: true,
        key2: false,
        key3: true,
      };
      const retVal = instance.getEnabledKeys();
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
        (instance as any).enabledKeys[pk] = false;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[pk];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });

    describe('when passed an object', () => {
      const hex = 'abcdef123456abcdef1234567891011123';
      const pk = {
        publicKey: Buffer.from(hex, 'hex' ),
        privateKey: Buffer.from('aaaa', 'hex'),
      };

      it('should store the keypair in this.keypairs', () => {
        instance.isForgeEnabledOn(pk)
        expect((instance as any).keypairs[hex]).to.be.deep.equal(pk);
      });

      it('should return true if the public key is enabled', () => {
        instance.enabledKeys[hex] = true;
        expect(instance.isForgeEnabledOn(pk)).to.be.true;
      });

      it('should return false if the public key is NOT enabled', () => {
        (instance as any).enabledKeys[hex] = false;
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
        delete instance.enabledKeys[hex];
        expect(instance.isForgeEnabledOn(pk)).to.be.false;
      });
    });
  });

  describe('enableForge', () => {
    beforeEach(() => {
      (instance as any).enabledKeys = {
        aaaa: false,
        bbbb: false,
        cccc: true,
      };
      (instance as any).keypairs = {
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
      instance.enableForge({publicKey: Buffer.from('bbbb', 'hex'), privateKey: Buffer.from('0')});
      expect(instance.enabledKeys).to.be.deep.equal({
        aaaa: false,
        bbbb: true,
        cccc: true,
      });
    });

    it('should store the passed key in keypairs', () => {
      const kp = {publicKey: Buffer.from('dddd', 'hex'), privateKey: Buffer.from('0')};
      instance.enableForge(kp);
      expect((instance as any).keypairs.dddd).to.be.deep.equal(kp);
    });
  });

  describe('disableForge', () => {
    beforeEach(() => {
      instance.enabledKeys = {
        bbbb: true,
        cccc: true,
      };
      (instance as any).keypairs = {
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
    beforeEach(() => {
      sandbox.useFakeTimers();
    });
    it('should call setTimeout');
    it('should call jobsQueue.register after 1 second');
    it('should call transactionsModule.fillPool in scheduled job');
    it('should call this.forge in scheduled job');
    it('should call logger.warn in scheduled job if transactionsModule.fillPool throws');
    it('should call logger.warn in scheduled job if this.forge throws');
  });

  describe('forge', () => {
    describe('When not ready to forge', () => {
      it('should call appState.get');
      it('should call logger.debug and return if loader.isSyncing');
      it('should call logger.debug and return if rounds is not loaded');
      it('should call logger.debug and return if rounds is ticking');
    });

    describe('When no delegates are loaded or no delegates at all', () => {
      it('should call loadDelegates if keypairs is empty');
      it('should call logger.debug and return if still no delegates after loadDelegates call');
    });

    describe('When waiting for next delegate slot', () => {
      it('should call slots.getSlotNumber twice');
      it('should call logger.debug and return if currentSlot is the same of last Block');
    });

    describe('When skipping slots or no blockData', () => {
      it('should call getBlockSlotData');
      it('should call logger.warn and return if getBlockSlotData returns null');
      it('should call slots.getSlotNumber four times');
      it('should call logger.debug and return if not current slot');
    });

    describe('When OK', () => {
      it('should call sequence.addAndPromise');
      it('should call broadcasterLogic.getPeers (in sequence worker)');
      it('should call appState.getComputed (in sequence worker)');
      it('should throw if node has poor consensus (in sequence worker)');
      it('should call blocksProcessModule.generateBlock (in sequence worker)');
      it('should call catchToLoggerAndRemapError if addAndPromise promise is rejected');
    });
  });

  describe('loadDelegates', () => {
    it('should return if no forging.secret or empty forging.secret');
    it('should call logger.info');
    it('should call crypto.createhash(sha256).update.digest');
    it('should call ed.makeKeypair with the hash');
    it('should call accountsModule.getAccount');
    it('should throw if account not found');
    it('should add the keypair to this.keypairs if account is a delegate');
    it('should call logger.info if account is a delegate');
    it('should call logger.warn if account is NOT a delegate');
    it('should call this.enableForge');
  });

  describe('getBlockSlotData', () => {
    it('should call delegatesModule.generateDelegateList');
    it('should call slots.getLastSlot');

    describe('if a valid delegate is found in the list and it is enabled to forge', () => {
      it('should call slots.getSlotTime i');
      it('should return an object with keypair and slotTime');
    });

    describe('else', () => {
      it('should return null');
    });
  });
});
