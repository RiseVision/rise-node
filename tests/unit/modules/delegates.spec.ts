import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { constants } from '../../../src/helpers';
import { DelegatesModule } from '../../../src/modules';

import {
  AppStateStub,
  BlockRewardLogicStub,
  ExceptionsManagerStub,
  LoggerStub,
  RoundsLogicStub,
  SlotsStub,
  ZSchemaStub
} from '../../stubs';
import { CreateHashSpy } from '../../stubs/utils/CreateHashSpy';
import { generateAccounts } from '../../utils/accountsUtils';

chai.use(chaiAsPromised);
const rewiredDelegatesModule = rewire('../../../src/modules/delegates');

// tslint:disable no-unused-expression
describe('modules/delegates', () => {
  let sandbox: SinonSandbox;
  let instance: DelegatesModule;
  let excManagerStub: ExceptionsManagerStub;
  let loggerStub: LoggerStub;
  let slotsStub: SlotsStub;
  let schemaStub: ZSchemaStub;
  let appStateStub: AppStateStub;
  let blockRewardLogicStub: BlockRewardLogicStub;
  let roundsLogicStub: RoundsLogicStub;
  let createHashSpy: CreateHashSpy;

  let pubKey: string;
  let votes: string[];
  const testAccounts = generateAccounts(101 + Math.ceil(Math.random() * 200));

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    excManagerStub       = new ExceptionsManagerStub();
    loggerStub           = new LoggerStub();
    slotsStub            = new SlotsStub();
    schemaStub           = new ZSchemaStub();
    appStateStub         = new AppStateStub();
    blockRewardLogicStub = new BlockRewardLogicStub();
    roundsLogicStub      = new RoundsLogicStub();

    instance                      = new rewiredDelegatesModule.DelegatesModule();
    (instance as any).constants   = constants;
    (instance as any).excManager  = excManagerStub;
    (instance as any).logger      = loggerStub;
    (instance as any).slots       = slotsStub;
    (instance as any).schema      = schemaStub;
    (instance as any).appState    = appStateStub;
    (instance as any).blockReward = blockRewardLogicStub;
    (instance as any).roundsLogic = roundsLogicStub;

    // Init frequently used test values
    pubKey = 'e22c25bcd696b94a3f4b017fdc681d714e275427a5112c2873e57c9637af3eed';
    votes  = [
      '-22c25bcd696b94a3f4b073e57c9637af3eede17fdc681d714e275427a5112c28',
      '+73e57c9637af3eede22c25bcd696b94a3f4b017fdc681d714e275427a5112c28',
    ];

    const crypto  = rewiredDelegatesModule.__get__('crypto');
    createHashSpy = new CreateHashSpy(crypto, sandbox);
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  describe('checkConfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const retVal = await instance.checkConfirmedDelegates(pubKey, votes);
      expect(checkDelegatesStub.calledOnce).to.be.true;
      expect(checkDelegatesStub.firstCall.args[0]).to.be.equal(pubKey);
      expect(checkDelegatesStub.firstCall.args[1]).to.be.deep.equal(votes);
      expect(checkDelegatesStub.firstCall.args[2]).to.be.equal('confirmed');
      expect(retVal).to.be.equal('test');
    });
  });

  describe('checkUnconfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const retVal = await instance.checkUnconfirmedDelegates(pubKey, votes);
      expect(checkDelegatesStub.calledOnce).to.be.true;
      expect(checkDelegatesStub.firstCall.args[0]).to.be.equal(pubKey);
      expect(checkDelegatesStub.firstCall.args[1]).to.be.deep.equal(votes);
      expect(checkDelegatesStub.firstCall.args[2]).to.be.equal('unconfirmed');
      expect(retVal).to.be.equal('test');
    });
  });

  describe('generateDelegateList', () => {
    const height = 12423;
    let keys: string[];
    let keysCopy: string[];
    let getKeysSortByVoteStub: SinonStub;

    beforeEach(() => {
      // Copy the original accounts so we can safely manipulate them
      const delegates = testAccounts.slice();
      // Create an array of publicKeys
      keys            = [];
      delegates.forEach((el) => {
        keys.push(el.publicKey);
      });
      getKeysSortByVoteStub = sandbox.stub(instance as any, 'getKeysSortByVote');
      getKeysSortByVoteStub.resolves(keys);
      keysCopy = keys.slice();
      roundsLogicStub.stubs.calcRound.returns(123);
    });

    it('should call getKeysSortByVote', async () => {
      await instance.generateDelegateList(height);
      expect(getKeysSortByVoteStub.calledOnce).to.be.true;
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.generateDelegateList(height);
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(height);
    });

    it('should call crypto.createHash and Hash.update with the round string as seedSource', async () => {
      await instance.generateDelegateList(height);
      expect(createHashSpy.spies.createHash.called).to.be.true;
      expect(createHashSpy.spies.createHash.firstCall.args[0]).to.be.equal('sha256');
      expect(createHashSpy.spies.update[0].called).to.be.true;
      expect(createHashSpy.spies.update[0].firstCall.args[0]).to.be.equal('123');
    });

    it('should call crypto.createHash every 5 keys, after the first time', async () => {
      const expectedCount = 1 + Math.ceil(testAccounts.length / 5);
      await instance.generateDelegateList(height);
      expect(createHashSpy.spies.createHash.callCount).to.be.equal(expectedCount);
    });

    it('should call hash.update with the previous hash buffer every 5 keys, after the first time', async () => {
      const expectedCount = 1 + Math.ceil(testAccounts.length / 5);
      await instance.generateDelegateList(height);
      expect(createHashSpy.spies.update.length).to.be.equal(expectedCount);
      const expectedSeeds = [];
      expectedSeeds.push('123');
      let currentSeed = createHashSpy.realCreateHash('sha256').update(expectedSeeds[0], 'utf8').digest();
      for (let i = 0; i < expectedCount - 1; i++) {
        expectedSeeds.push(currentSeed.toString('hex'));
        currentSeed = createHashSpy.realCreateHash('sha256').update(currentSeed).digest();
      }
      const returnedSeeds = [];
      createHashSpy.spies.update.forEach((spy) => {
        returnedSeeds.push(spy.firstCall.args[0].toString('hex'));
      });
      expect(returnedSeeds).to.be.deep.equal(expectedSeeds);
    });

    it('should guarantee predictable sorting order with the same input array and during the same round', async () => {
      const retVal1 = await instance.generateDelegateList(height);
      getKeysSortByVoteStub.resolves(keysCopy);
      const retVal2 = await instance.generateDelegateList(height);
      expect(retVal1).to.be.deep.equal(retVal2);
    });
  });

  describe('getDelegates', () => {
    it('should throw if !query');
    it('should call accountsModule.getAccounts');
    it('should call blockReward.calcSupply');
    it('should call OrderBy using the passed value');
    it('should throw on OrderBy error');
    it('should return the expected object');
    it('should limit correctly when limit passed');
    it('should limit correctly when offset passed');
  });

  describe('assertValidBlockSlot', () => {
    it('should call generateDelegateList');
    it('should call getSlotNumber');
    it('should call logger.error and throw if delegate is not found');
    it('should call logger.error and throw if delegate is not the generator of the block');
  });

  describe('onBlockchainReady', () => {
    it('should set loaded to true');
  });

  describe('cleanup', () => {
    it('should set loaded to false');
  });

  describe('isLoaded', () => {
    it('should return this.isloaded');
  });

  describe('getKeysSortByVote', () => {
    it('should call accountsModule');
    it('should return an array of publicKeys only');
  });

  describe('checkDelegates', () => {
    it('should call accountsModule.getAccount');
    it('should throw if account not found');
    it('should throw if invalid math operator found in votes');
    it('should call schema.validate for each pk');
    it('should throw if invalid public key in votes');
    it('should throw if trying to vote again for the same delegate');
    it('should throw if trying to remove vote for a non-voted delegate');
  });
});
