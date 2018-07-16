import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import {Container} from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import * as helpers from '../../../src/helpers';
import {Symbols} from '../../../src/ioc/symbols';
import { SignedBlockType } from '../../../src/logic';
import { DelegatesModule } from '../../../src/modules';
import {
  AccountsModuleStub,
  BlockRewardLogicStub,
  BlocksModuleStub,
  LoggerStub,
  RoundsLogicStub,
  SlotsStub,
  ZSchemaStub
} from '../../stubs';
import { CreateHashSpy } from '../../stubs/utils/CreateHashSpy';
import { generateAccounts } from '../../utils/accountsUtils';
import { createContainer } from '../../utils/containerCreator';
import { AccountsModel, BlocksModel } from '../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/delegates', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: DelegatesModule;

  let accountsModuleStub: AccountsModuleStub;
  let blocksModuleStub: BlocksModuleStub;
  let blockRewardLogicStub: BlockRewardLogicStub;
  let loggerStub: LoggerStub;
  let roundsLogicStub: RoundsLogicStub;
  let slotsStub: SlotsStub;
  let schemaStub: ZSchemaStub;

  let blocksModel: typeof BlocksModel;
  let accountsModel: typeof AccountsModel;

  let createHashSpy: CreateHashSpy;

  let pubKey: string;
  let votes: string[];
  let testAccounts = generateAccounts(101 + Math.ceil(Math.random() * 200));
  // Add delegate-specific fields
  testAccounts     = testAccounts.map((el, k) => {
    (el as any).vote           = (1000 - k) * 100000;
    (el as any).producedblocks = 100000 - (10 * k);
    (el as any).missedblocks   = k * 7;
    (el as any).delegates      = [];
    (el as any).u_delegates    = [];
    return el;
  });

  const totalSupply = 123456000;
  let signedBlock: SignedBlockType;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    container = createContainer();

    roundsLogicStub        = container.get(Symbols.logic.rounds);
    accountsModuleStub     = container.get(Symbols.modules.accounts);
    blocksModuleStub       = container.get(Symbols.modules.blocks);
    blockRewardLogicStub   = container.get(Symbols.logic.blockReward);
    slotsStub              = container.get(Symbols.helpers.slots);
    loggerStub             = container.get(Symbols.helpers.logger);
    schemaStub             = container.get(Symbols.generic.zschema);

    container.rebind(Symbols.modules.delegates).to(DelegatesModule).inSingletonScope();
    instance = container.get(Symbols.modules.delegates);

    // Init frequently used test values
    pubKey = 'e22c25bcd696b94a3f4b017fdc681d714e275427a5112c2873e57c9637af3eed';
    votes  = [
      '+73e57c9637af3eede22c25bcd696b94a3f4b017fdc681d714e275427a5112c28',
    ];

    createHashSpy                                     = new CreateHashSpy(crypto, sandbox);
    const lastBlock                                   = {
      blockSignature      : Buffer.from('blockSignature'),
      generatorPublicKey  : Buffer.from('genPublicKey'),
      height              : 12422,
      id                  : 'blockID',
      numberOfTransactions: 0,
      payloadHash         : Buffer.from('payloadHash'),
      payloadLength       : 0,
      previousBlock       : 'previous',
      reward              : 15,
      timestamp           : Date.now(),
      totalAmount         : 0,
      totalFee            : 0,
      version             : 1,
    };
    blocksModel = container.get(Symbols.models.blocks);
    accountsModel = container.get(Symbols.models.accounts);
    blocksModuleStub.lastBlock                        = blocksModel.classFromPOJO(lastBlock);
    blockRewardLogicStub.stubConfig.calcSupply.return = totalSupply;
    signedBlock                                       = Object.assign({}, lastBlock);
    signedBlock.height++;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkConfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const acc = new AccountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
      const retVal = await instance.checkConfirmedDelegates(acc, votes);
      expect(checkDelegatesStub.calledOnce).to.be.true;
      expect(checkDelegatesStub.firstCall.args[0]).to.be.deep.equal(acc);
      expect(checkDelegatesStub.firstCall.args[1]).to.be.deep.equal(votes);
      expect(checkDelegatesStub.firstCall.args[2]).to.be.equal('confirmed');
      expect(retVal).to.be.equal('test');
    });
  });

  describe('checkUnconfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const acc = new AccountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
      const retVal = await instance.checkUnconfirmedDelegates(acc, votes);
      expect(checkDelegatesStub.calledOnce).to.be.true;
      expect(checkDelegatesStub.firstCall.args[0]).to.be.deep.equal(acc);
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
      keys            = delegates.map((d) => d.publicKey);
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

    it('should return consistent data with precomputed i/o', async () => {
      const pk = new Array(101).fill(null).map((a, idx) => (idx).toString(16));
      getKeysSortByVoteStub.resolves(pk);
      expect(await instance.generateDelegateList(10)).to.be.deep.eq(
        // tslint:disable-next-line: max-line-length
        ['1', '41', '3f', '0', '42', '5a', '11', 'd', 'b', '8', '31', '5c', '4f', '1c', '15', '32', '3d', '25', '2f', '13', '46', '56', '29', '61', '58', '33', '38', '1f', '3a', '47', '17', '9', '43', 'e', '2b', '36', '37', '24', 'a', '30', '14', '4e', '48', '5d', '2', '28', '2d', '39', '64', '26', '3c', '3e', '19', '23', '1e', '44', '34', '57', '2a', '3b', '5', '1a', '27', '2c', 'f', '59', '6', '40', '4b', '45', '4c', '1d', '7', '49', '4a', '53', '2e', '18', '4', '60', '54', '10', '5e', '12', '50', '1b', '21', '16', '5b', '3', '20', '62', '55', '22', '52', '5f', 'c', '35', '4d', '63', '51']
      );
      expect(await instance.generateDelegateList(1000)).to.be.deep.eq(
        // tslint:disable-next-line: max-line-length
        ['41', '59', '2c', '1', '6', '20', '25', '1c', '5c', 'b', '26', '55', '60', '3a', '56', '3c', '1a', '24', '39', '13', '4c', '21', '4e', '35', '5b', '3e', '34', '9', '2a', '1d', '61', '8', '40', '15', '5d', '1e', '44', '37', '31', '64', '46', '4', '7', '22', '3f', '14', '28', '57', '51', 'a', '5', '27', '33', '36', '17', '4b', '19', '16', '48', '3b', '5a', '38', '30', '2', '32', '3', '11', 'f', '53', '45', '2e', '47', 'd', '49', '4a', '12', '2d', '58', '42', 'c', '50', '3d', '52', '2f', '54', '1f', 'e', '29', '62', '0', '43', '4d', '1b', '2b', '5e', '5f', '4f', '23', '18', '63', '10']
      );
    });
  });

  describe('getDelegates', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.getAccounts.resolves(testAccounts);
    });

    it('should throw if !query', async () => {
      await expect(instance.getDelegates(undefined)).to.be.rejectedWith('Missing query argument');
    });

    it('should call accountsModule.getAccounts', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        sort      : { vote: -1, publicKey: 1 },
      });
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[1]).to.be.deep.equal([
        'username', 'address', 'publicKey', 'vote', 'missedblocks', 'producedblocks',
      ]);
    });

    it('should call blockReward.calcSupply', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(blockRewardLogicStub.stubs.calcSupply.calledOnce).to.be.true;
      expect(blockRewardLogicStub.stubs.calcSupply.firstCall.args[0]).to.be.equal(blocksModuleStub.lastBlock.height);
    });

    it('should call OrderBy using the passed value', async () => {
      const orderBySpy = sandbox.spy(helpers, 'OrderBy');
      await instance.getDelegates({ orderBy: 'votes' });
      expect(orderBySpy.calledOnce).to.be.true;
      expect(orderBySpy.firstCall.args[0]).to.be.equal('votes');
      expect(orderBySpy.firstCall.args[1]).to.be.deep.equal({
        quoteField: false,
        sortField : null,
        sortFields: [],
        sortMethod: null,
      });
    });

    it('should throw on OrderBy error', async () => {
      sandbox.stub(helpers, 'OrderBy').returns({ error: 'OrderBy Err', });
      await expect(instance.getDelegates({ orderBy: 'votes' })).to.be.rejectedWith('OrderBy Err');
    });

    it('should return the expected object', async () => {
      const retVal = await instance.getDelegates({ orderBy: 'votes', limit: 50, offset: 40 });
      expect(retVal.count).to.be.equal(testAccounts.length);
      expect(Array.isArray(retVal.delegates)).to.be.true;
      retVal.delegates.forEach((delegate, key) => {
        expect(delegate.info.rank).to.be.equal(key + 1);
        expect(delegate.info.approval).to.be.equal(Math.round((delegate.delegate.vote / totalSupply) * 1e4) / 1e2);
        const percent = Math.abs(
          100 - (delegate.delegate.missedblocks / ((delegate.delegate.producedblocks + delegate.delegate.missedblocks) / 100))
        ) || 0;
        expect(delegate.info.productivity).to.be.equal(
          (key + 1 > 101) ? 0 : Math.round(percent * 1e2) / 1e2
        );
      });
      expect(retVal.limit).to.be.equal(90);
      expect(retVal.offset).to.be.equal(40);
      expect(retVal.sortField).to.be.equal('votes');
      expect(retVal.sortMethod).to.be.null;
    });

    it('should limit correctly when limit passed', async () => {
      const retVal = await instance.getDelegates({ orderBy: 'votes', limit: 50 });
      expect(retVal.limit).to.be.equal(50);
    });

    it('should limit correctly when offset passed', async () => {
      const retVal = await instance.getDelegates({ orderBy: 'votes', limit: 50, offset: 50 });
      expect(retVal.limit).to.be.equal(100);
    });
  });

  describe('assertValidBlockSlot', () => {
    let keys: string[];
    let getKeysSortByVoteStub: SinonStub;
    let generateDelegateListStub: SinonStub;
    const curSlot = 1294;

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
      roundsLogicStub.stubs.calcRound.returns(123);
      generateDelegateListStub = sandbox.stub(instance, 'generateDelegateList').resolves(keys
        .map((k) => Buffer.from(k, 'hex')));
      slotsStub.stubs.getSlotNumber.returns(curSlot);
      signedBlock.generatorPublicKey = Buffer.from(keys[curSlot % 101], 'hex');
    });

    it('should call generateDelegateList', async () => {
      await instance.assertValidBlockSlot(signedBlock);
      expect(generateDelegateListStub.calledOnce).to.be.true;
      expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(signedBlock.height);
    });

    it('should call getSlotNumber', async () => {
      await instance.assertValidBlockSlot(signedBlock);
      expect(slotsStub.stubs.getSlotNumber.calledOnce).to.be.true;
      expect(slotsStub.stubs.getSlotNumber.firstCall.args[0]).to.be.equal(signedBlock.timestamp);
    });

    it('should call logger.error and throw if delegate is not the generator of the block', async () => {
      signedBlock.generatorPublicKey = Buffer.from('aabb', 'hex');
      await expect(instance.assertValidBlockSlot(signedBlock)).to.be.rejectedWith('Failed to verify slot ' + curSlot);
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args[0]).to.match(/^Expected generator .+ Received generator: .+/);
    });

  });

  describe('onBlockchainReady', () => {
    it('should set loaded to true', async () => {
      await instance.onBlockchainReady();
      expect((instance as any).loaded).to.be.true;
    });
  });

  describe('cleanup', () => {
    it('should set loaded to false', async () => {
      await instance.cleanup();
      expect((instance as any).loaded).to.be.false;
    });
  });

  describe('isLoaded', () => {
    it('should return this.loaded', () => {
      const retVal = instance.isLoaded();
      expect(retVal).to.be.equal((instance as any).loaded);
    });
  });

  describe('getKeysSortByVote', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.getAccounts.resolves(testAccounts);
    });
    it('should call accountsModule.getAccounts', async () => {
      await (instance as any).getKeysSortByVote();
      expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        limit     : 101,
        sort      : { vote: -1, publicKey: 1 },
      });
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[1]).to.be.deep.equal(['publicKey']);
    });

    it('should return an array of publicKeys only', async () => {
      const retVal = await (instance as any).getKeysSortByVote();
      expect(Array.isArray(retVal)).to.be.true;
      retVal.forEach((el, k) => {
        expect(el).to.be.equal(testAccounts[k].publicKey);
      });
    });
  });

  describe('checkDelegates', () => {
    let theAccount: any;
    beforeEach(() => {
      theAccount             = new AccountsModel({address: testAccounts[0].address });
      theAccount.publicKey = Buffer.from(testAccounts[0].publicKey, 'hex');
      theAccount.privKey = Buffer.from(testAccounts[0].privKey, 'hex');
      theAccount.delegates   = [];
      theAccount.u_delegates = [];
      accountsModuleStub.stubs.getAccount.onFirstCall().resolves({});
    });

    it('should throw if account not provided', async () => {
      await expect((instance as any).checkDelegates(null, [], 'confirmed')).to.be.
        rejectedWith('Account not found');
    });

    it('should throw if invalid math operator found in votes', async () => {
      await expect((instance as any).checkDelegates(theAccount, ['*123'], 'confirmed')).to.be.
        rejectedWith('Invalid math operator');
    });

    it('should call schema.validate for each pk', async () => {
      schemaStub.stubs.validate.returns(true);
      await (instance as any).checkDelegates(theAccount, votes, 'confirmed');
      expect(schemaStub.stubs.validate.callCount).to.be.equal(votes.length);
      votes.forEach((pk, i) => {
        expect(schemaStub.stubs.validate.getCall(i).args[0]).to.be.equal(pk.substr(1));
        expect(schemaStub.stubs.validate.getCall(i).args[1]).to.be.deep.equal({ format: 'publicKey', type: 'string' });
      });
    });

    it('should throw if invalid public key in votes', async () => {
      schemaStub.stubs.validate.returns(false);
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.
        rejectedWith('Invalid public key');
    });

    it('should throw if trying to vote again for the same delegate', async () => {
      theAccount.delegates.push(votes[0].substr(1));
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.
        rejectedWith('Failed to add vote, account has already voted for this delegate');
    });

    it('should throw if trying to remove vote for a non-voted delegate', async () => {
      const unvotes = votes.slice();
      unvotes[0]    = unvotes[0].replace('+', '-');
      await expect((instance as any).checkDelegates(theAccount, unvotes, 'confirmed')).to.be.
        rejectedWith('Failed to remove vote, account has not voted for this delegate');
    });

    it('should call accountsModule.getAccount on vote publicKey', async () => {
      await (instance as any).checkDelegates(theAccount, votes, 'confirmed');
      expect(accountsModuleStub.stubs.getAccount.callCount).to.be.equal(1);
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        publicKey : Buffer.from(votes[0].substr(1), 'hex'),
      });
    });

    it('should throw if delegate not found', async () => {
      accountsModuleStub.stubs.getAccount.onFirstCall().resolves(null);
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.
        rejectedWith('Delegate not found');
    });

    it('should throw if trying to vote or unvote too many delegates', async () => {
      accountsModuleStub.stubs.getAccount.onSecondCall().resolves({});
      const wrongVotes = ['+deleg1', '+deleg2'];
      await expect((instance as any).checkDelegates(theAccount.publicKey, wrongVotes, 'confirmed')).to.be.
        rejectedWith('Maximum number of 1 votes exceeded (1 too many)');
    });
  });
});
