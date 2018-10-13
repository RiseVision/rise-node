import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { AccountsModelForDPOS } from '../../../src/models';
import { ModelSymbols } from '@risevision/core-models';
import { generateWallets } from '@risevision/core-accounts/tests/unit/utils/accountsUtils';
import { IAccountsModule, IBlocksModel, IBlocksModule, Symbols } from '@risevision/core-interfaces';
import { DelegatesModule } from '../../../src/modules';
import { RoundsLogic } from '../../../src/logic/rounds';
import { BlockRewardLogic } from '@risevision/core-blocks';
import { DposConstantsType, dPoSSymbols, Slots } from '../../../src/helpers';
import { ConstantsType, SignedBlockType } from '@risevision/core-types';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/delegates', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: DelegatesModule;

  let accountsModule: IAccountsModule;
  let blocksModule: IBlocksModule;
  let blocksReward: BlockRewardLogic;
  let roundsLogic: RoundsLogic;
  let slots: Slots;
  let calcSupplyStub: SinonStub;

  let blocksModel: typeof IBlocksModel;
  let accountsModel: typeof AccountsModelForDPOS;
  let constants: ConstantsType;
  let dposConstants: DposConstantsType;
  let pubKey: string;
  let votes: string[];
  let testAccounts = generateWallets(101 + Math.ceil(Math.random() * 200));
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

  beforeEach(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-consensus-dpos', 'core-helpers', 'core']);

    dposConstants  = container.get(dPoSSymbols.constants);
    constants      = container.get(Symbols.generic.constants);
    roundsLogic    = container.get(dPoSSymbols.logic.rounds);
    accountsModule = container.get(Symbols.modules.accounts);
    blocksModule   = container.get(Symbols.modules.blocks);
    blocksReward   = container.get(Symbols.logic.blockReward);
    slots          = container.get(dPoSSymbols.helpers.slots);

    // Init frequently used test values
    pubKey = 'e22c25bcd696b94a3f4b017fdc681d714e275427a5112c2873e57c9637af3eed';
    votes  = [
      '+73e57c9637af3eede22c25bcd696b94a3f4b017fdc681d714e275427a5112c28',
    ];

    const lastBlock        = {
      blockSignature      : Buffer.from('blockSignature'),
      generatorPublicKey  : Buffer.from(testAccounts[33].publicKey, 'hex'),
      height              : 12422,
      id                  : 'blockID',
      numberOfTransactions: 0,
      payloadHash         : Buffer.from('payloadHash'),
      payloadLength       : 0,
      previousBlock       : 'previous',
      reward              : 15,
      timestamp           : 1000,
      totalAmount         : 0,
      totalFee            : 0,
      version             : 1,
    };
    blocksModel            = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    accountsModel          = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    blocksModule.lastBlock = new blocksModel(lastBlock);
    calcSupplyStub         = sandbox.stub(blocksReward, 'calcSupply').returns(totalSupply);
    signedBlock            = Object.assign({}, lastBlock);
    signedBlock.height++;
    instance = container.get(dPoSSymbols.modules.delegates);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkConfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const acc    = new accountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
      const acc    = new accountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
      const delegates       = testAccounts.slice();
      // Create an array of publicKeys
      keys                  = delegates.map((d) => d.publicKey);
      getKeysSortByVoteStub = sandbox.stub(instance as any, 'getKeysSortByVote');
      getKeysSortByVoteStub.resolves(keys);
      keysCopy = keys.slice();
    });

    it('should call getKeysSortByVote', async () => {
      await instance.generateDelegateList(height);
      expect(getKeysSortByVoteStub.calledOnce).to.be.true;
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
      expect(await instance.generateDelegateList(123 * dposConstants.activeDelegates)).to.be.deep.eq(
        // tslint:disable-next-line: max-line-length
        ['1', '41', '3f', '0', '42', '5a', '11', 'd', 'b', '8', '31', '5c', '4f', '1c', '15', '32', '3d', '25', '2f', '13', '46', '56', '29', '61', '58', '33', '38', '1f', '3a', '47', '17', '9', '43', 'e', '2b', '36', '37', '24', 'a', '30', '14', '4e', '48', '5d', '2', '28', '2d', '39', '64', '26', '3c', '3e', '19', '23', '1e', '44', '34', '57', '2a', '3b', '5', '1a', '27', '2c', 'f', '59', '6', '40', '4b', '45', '4c', '1d', '7', '49', '4a', '53', '2e', '18', '4', '60', '54', '10', '5e', '12', '50', '1b', '21', '16', '5b', '3', '20', '62', '55', '22', '52', '5f', 'c', '35', '4d', '63', '51']
      );
    });
  });

  describe('getDelegates', () => {
    let getAccountsStub: SinonStub;
    beforeEach(() => {
      getAccountsStub = sandbox.stub(accountsModule, 'getAccounts').resolves(testAccounts);
    });

    it('should throw if !query', async () => {
      await expect(instance.getDelegates(undefined)).to.be.rejectedWith('Missing query argument');
    });

    it('should call accountsModule.getAccounts', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(getAccountsStub.calledOnce).to.be.true;
      expect(getAccountsStub.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        sort      : { vote: -1, publicKey: 1 },
      });
    });

    it('should call blockReward.calcSupply', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(calcSupplyStub.calledOnce).to.be.true;
      expect(calcSupplyStub.firstCall.args[0]).to.be.equal(blocksModule.lastBlock.height);
    });

    // it('should call OrderBy using the passed value', async () => {
    //   const orderBySpy = sandbox.spy(helpers, 'OrderBy');
    //   await instance.getDelegates({ orderBy: 'votes' });
    //   expect(orderBySpy.calledOnce).to.be.true;
    //   expect(orderBySpy.firstCall.args[0]).to.be.equal('votes');
    //   expect(orderBySpy.firstCall.args[1]).to.be.deep.equal({
    //     quoteField: false,
    //     sortField : null,
    //     sortFields: [],
    //     sortMethod: null,
    //   });
    // });
    //
    // it('should throw on OrderBy error', async () => {
    //   sandbox.stub(helpers, 'OrderBy').returns({ error: 'OrderBy Err', });
    //   await expect(instance.getDelegates({ orderBy: 'votes' })).to.be.rejectedWith('OrderBy Err');
    // });

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
    const curSlot = 33;

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
      // roundsLogic.stubs.calcRound.returns(123);
      generateDelegateListStub       = sandbox.stub(instance, 'generateDelegateList')
        .resolves(keys
          .map((k) => Buffer.from(k, 'hex')));
      // slots.stubs.getSlotNumber.returns(curSlot);
      signedBlock.generatorPublicKey = Buffer.from(keys[curSlot % 101], 'hex');
    });

    it('should call generateDelegateList', async () => {
      await instance.assertValidBlockSlot(signedBlock);
      expect(generateDelegateListStub.calledOnce).to.be.true;
      expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(signedBlock.height);
    });

    it('should validate slot getSlotNumber', async () => {
      await instance.assertValidBlockSlot(signedBlock);
    });

    it('should throw error if generator is different', async () => {
      await expect(instance.assertValidBlockSlot({
        ...signedBlock,
        timestamp: signedBlock.timestamp + constants.blockTime
      }))
        .rejectedWith('Failed to verify slot 34');
    });

  });

  describe('getKeysSortByVote', () => {
    let getAccountsStub: SinonStub;
    beforeEach(() => {
      getAccountsStub = sandbox.stub(accountsModule, 'getAccounts').resolves(testAccounts);
    });
    it('should call accountsModule.getAccounts', async () => {
      await (instance as any).getKeysSortByVote();
      expect(getAccountsStub.calledOnce).to.be.true;
      expect(getAccountsStub.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        limit     : 101,
        sort      : { vote: -1, publicKey: 1 },
      });
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
    let getAccountStub: SinonStub;
    beforeEach(() => {
      theAccount             = new accountsModel({ address: testAccounts[0].address });
      theAccount.publicKey   = Buffer.from(testAccounts[0].publicKey, 'hex');
      theAccount.privKey     = Buffer.from(testAccounts[0].privKey, 'hex');
      theAccount.delegates   = [];
      theAccount.u_delegates = [];
      getAccountStub         = sandbox.stub(accountsModule, 'getAccount').resolves({});
    });

    it('should throw if account not provided', async () => {
      await expect((instance as any).checkDelegates(null, [], 'confirmed')).to.be.rejectedWith('Account not found');
    });

    it('should throw if invalid math operator found in votes', async () => {
      await expect((instance as any).checkDelegates(theAccount, ['*123'], 'confirmed')).to.be.rejectedWith('Invalid math operator');
    });

    it('should throw if invalid public key in votes', async () => {
      votes.push('+meow')
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.rejectedWith('Invalid public key');
    });

    it('should throw if trying to vote again for the same delegate', async () => {
      theAccount.delegates.push(votes[0].substr(1));
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.rejectedWith('Failed to add vote, account has already voted for this delegate');
    });

    it('should throw if trying to remove vote for a non-voted delegate', async () => {
      const unvotes = votes.slice();
      unvotes[0]    = unvotes[0].replace('+', '-');
      await expect((instance as any).checkDelegates(theAccount, unvotes, 'confirmed')).to.be.rejectedWith('Failed to remove vote, account has not voted for this delegate');
    });

    it('should call accountsModule.getAccount on vote publicKey', async () => {
      await (instance as any).checkDelegates(theAccount, votes, 'confirmed');
      expect(getAccountStub.callCount).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        publicKey : Buffer.from(votes[0].substr(1), 'hex'),
      });
    });

    it('should throw if delegate not found', async () => {
      getAccountStub.onFirstCall().resolves(null);
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.rejectedWith('Delegate not found');
    });

    it('should throw if trying to vote or unvote too many delegates', async () => {
      getAccountStub.onSecondCall().resolves({});
      const wrongVotes = ['+' + testAccounts[0].publicKey, '+' + testAccounts[1].publicKey];
      await expect((instance as any).checkDelegates(theAccount.publicKey, wrongVotes, 'confirmed')).to.be.rejectedWith('Maximum number of 1 votes exceeded (1 too many)');
    });
  });
});
