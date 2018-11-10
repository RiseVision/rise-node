import { expect } from 'chai';
import * as chai from 'chai';
import * as crypto from 'crypto';
import * as chaiAsPromised from 'chai-as-promised';
import * as supersha from 'supersha';
import { Container } from 'inversify';
import * as MersenneTwister from 'mersenne-twister';
import { Op } from 'sequelize';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import * as helpers from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedBlockType } from '../../../src/logic';
import { AccountsModel, BlocksModel } from '../../../src/models';
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
import { generateAccounts } from '../../utils/accountsUtils';
import { createContainer } from '../../utils/containerCreator';

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

  let sha256Spy: SinonSpy;

  let pubKey: string;
  let votes: string[];
  let testAccounts = generateAccounts(101 + Math.ceil(Math.random() * 200));
  let findOneStub: SinonStub;

  // Add delegate-specific fields
  testAccounts = testAccounts.map((el, k) => {
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
    sandbox   = sinon.createSandbox();
    container = createContainer();

    roundsLogicStub      = container.get(Symbols.logic.rounds);
    accountsModuleStub   = container.get(Symbols.modules.accounts);
    blocksModuleStub     = container.get(Symbols.modules.blocks);
    blockRewardLogicStub = container.get(Symbols.logic.blockReward);
    slotsStub            = container.get(Symbols.helpers.slots);
    loggerStub           = container.get(Symbols.helpers.logger);
    schemaStub           = container.get(Symbols.generic.zschema);

    container.rebind(Symbols.modules.delegates).to(DelegatesModule).inSingletonScope();
    instance = container.get(Symbols.modules.delegates);

    // Init frequently used test values
    pubKey = 'e22c25bcd696b94a3f4b017fdc681d714e275427a5112c2873e57c9637af3eed';
    votes  = [
      '+73e57c9637af3eede22c25bcd696b94a3f4b017fdc681d714e275427a5112c28',
    ];

    sha256Spy                                         = sandbox.spy(supersha, 'sha256');
    const lastBlock                                   = {
      blockSignature          : Buffer.from('blockSignature'),
      previousBlockSignature  : Buffer.from('previousblockSignature'),
      generatorPublicKey      : Buffer.from('genPublicKey'),
      height                  : 12422,
      id                      : 'blockID',
      numberOfTransactions    : 0,
      payloadHash             : Buffer.from('payloadHash'),
      previousBlockIDSignature: null,
      payloadLength           : 0,
      previousBlock           : 'previous',
      reward                  : 15,
      timestamp               : Date.now(),
      totalAmount             : 0,
      totalFee                : 0,
      version                 : 1,
    };
    blocksModel                                       = container.get(Symbols.models.blocks);
    accountsModel                                     = container.get(Symbols.models.accounts);
    blocksModuleStub.lastBlock                        = blocksModel.classFromPOJO(lastBlock);
    blockRewardLogicStub.stubConfig.calcSupply.return = totalSupply;
    signedBlock                                       = Object.assign({}, lastBlock);
    signedBlock.height++;
    slotsStub.stubs.getDelegatesPoolSize.returns(101);
    findOneStub = sandbox.stub((blocksModel as any), 'findOne');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkConfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(instance as any, 'checkDelegates');
      checkDelegatesStub.resolves('test');
      const acc    = new AccountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
      const acc    = new AccountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
      roundsLogicStub.stubs.calcRound.returns(123);
      (instance as any).constants.dposv2.firstBlock = Number.MAX_SAFE_INTEGER;
      slotsStub.delegates                           = 101;
      roundsLogicStub.stubs.lastInRound.returns(19532);
    });

    it('should call getKeysSortByVote', async () => {
      await instance.generateDelegateList(height);
      expect(getKeysSortByVoteStub.calledOnce).to.be.true;
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.generateDelegateList(height);
      console.log(roundsLogicStub.stubs.calcRound.callCount);
      expect(roundsLogicStub.stubs.calcRound.called).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(height);
    });

    it('should call supersha.sha256 with the round string as seedSource', async () => {
      await instance.generateDelegateList(height);
      expect(sha256Spy.called).to.be.true;
      expect(sha256Spy.firstCall.args[0]).to.be.deep.equal(Buffer.from('123', 'utf-8'));
    });

    it('should call supersha.sha256 every 5 keys, after the first time', async () => {
      const expectedCount = 1 + Math.ceil(testAccounts.length / 5);
      await instance.generateDelegateList(height);
      expect(sha256Spy.callCount).to.be.equal(expectedCount);
    });

    it('should call hash.update with the previous hash buffer every 5 keys, after the first time', async () => {
      const expectedCount = 1 + Math.ceil(testAccounts.length / 5);
      await instance.generateDelegateList(height);
      expect(sha256Spy.callCount).to.be.equal(expectedCount);
      const expectedSeeds = [];
      expectedSeeds.push(Buffer.from('123', 'utf-8'));
      let currentSeed = crypto.createHash('sha256').update(expectedSeeds[0], 'utf8').digest();
      for (let i = 0; i < expectedCount - 1; i++) {
        expectedSeeds.push(currentSeed);
        currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
      }
      const returnedSeeds = [];
      sha256Spy.getCalls().forEach((call) => {
        returnedSeeds.push(call.args[0]);
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
      const pk = new Array(101).fill(null).map((a, idx) => ({ publicKey: idx.toString(16) }));
      getKeysSortByVoteStub.resolves(pk);
      expect(await instance.generateDelegateList(10)).to.be.deep.eq(
        // tslint:disable-next-line: max-line-length
        ['1', '41', '3f', '0', '42', '5a', '11', 'd', 'b', '8', '31', '5c', '4f', '1c', '15', '32', '3d', '25', '2f', '13', '46', '56', '29', '61', '58', '33', '38', '1f', '3a', '47', '17', '9', '43', 'e', '2b', '36', '37', '24', 'a', '30', '14', '4e', '48', '5d', '2', '28', '2d', '39', '64', '26', '3c', '3e', '19', '23', '1e', '44', '34', '57', '2a', '3b', '5', '1a', '27', '2c', 'f', '59', '6', '40', '4b', '45', '4c', '1d', '7', '49', '4a', '53', '2e', '18', '4', '60', '54', '10', '5e', '12', '50', '1b', '21', '16', '5b', '3', '20', '62', '55', '22', '52', '5f', 'c', '35', '4d', '63', '51']
      );
    });

    describe('dposv2', () => {
      let delegates;
      let seedGenStub: SinonStub;
      beforeEach(() => {
        (instance as any).constants.dposv2.firstBlock = 0;
        // we add delegate.id for easily mapping them
        delegates                                     = new Array(202).fill(null).map((a, idx) => ({
          publicKey: Buffer.from(Math.ceil(10000000 * idx + Math.random() * 1000000).toString(16), 'hex'),
          vote     : Math.ceil((201 - idx) * 10000 + Math.random() * 999),
        }));
        delegates[201].vote                           = 0;
        getKeysSortByVoteStub.resolves(delegates);
        roundsLogicStub.stubs.calcRound.callsFake((h) => Math.ceil(h / slotsStub.delegates));
        roundsLogicStub.stubs.lastInRound.callsFake((r) => Math.ceil(r * 101));
        findOneStub.returns({ id: '1231352636353', previousBlockIDSignature: crypto.randomBytes(64) });
        seedGenStub = sandbox.stub(instance as any, 'calculateSafeRoundSeed').callsFake(() => {
          const toRet = [];
          for (let i = 0; i < 8; i++) {
            toRet.push(Math.round(Math.random() * Number.MAX_SAFE_INTEGER));
          }
          return toRet;
        });
      });
      after(() => {
        (instance as any).constants.dposv2.firstBlock = Number.MAX_SAFE_INTEGER;
      });

      afterEach(() => {
        seedGenStub.restore();
      });

      it('should produce the same array, given the same round and delegates', async function () {
        seedGenStub.restore();
        this.timeout(10000);
        slotsStub.delegates = 101;
        const roundNum      = Math.round(Math.random() * 1000000);
        const list          = await instance.generateDelegateList(roundNum);
        const list2         = await instance.generateDelegateList(roundNum);
        expect(list).to.be.deep.eq(list2);
      });

      it('should return consistent data with precomputed i/o', async () => {
        seedGenStub.restore();
        findOneStub.returns({
          id                      : '347457463453453634',
          previousBlockIDSignature: Buffer.from(
            '6c5806573316c52bdd62a2bff4c4ae6ccf6da78cbedf18f034d62d21524482c0' +
            'edefe6b73cf2e1041fe00dd496571d1147b37c87ee2d738da4ba86fcecd7b7df',
            'hex'
          ),
        });
        // DPOS v2
        const pk = new Array(202)
          .fill(null).map((a, idx) => {
            return {
              publicKey: Buffer.from(((idx + 1) * 1000000).toString(16), 'hex'),
              vote     : 10000000000000 - (idx * 1000000),
            };
          });
        getKeysSortByVoteStub.resolves(pk);
        const bufferList = await instance.generateDelegateList(1001);
        const stringList = bufferList.map((k) => k.toString('hex'));
        expect(stringList).to.be.deep.eq(
          // tslint:disable-next-line: max-line-length
          [
            '94c5f0', '59a538', '16e360', 'a3140c', '112a88', 'f424', '96ae38', '365c04', '1ba814', '876bf8', 'a21fe8',
            '328b74', 'a8cce4', '6dac2c', '839b68', '3c14dc', '8d24d0', '6cb808', '2bde78', '7a1200', '510ff4',
            '56c8cc', '6acfc0', '745928', '9d5b34', 'b43e94', '8f0d18', '17d784', '7bfa48', '6bc3e4', 'bdc7fc',
            'b34a70', '92dda8', 'bfb044', '280de8', '393870', 'a6e49c', '103664', 'b626dc', '1f78a4', '2dc6c0',
            'a9c108', 'b80f24', 'bcd3d8', '2faf08', '8a4864', '895440', '375028', '3fe56c', 'b16228', '3b20b8',
            '496ed4', '3d0900', '41cdb4', '848f8c', '2cd29c', '47868c', '2dc6c0', '791ddc', '40d990', '1312d0',
            '7ed6b4', 'aab52c', '319750', '469268', '6f9474', 'b532b8', '69db9c', '4e3388', '1ab3f0', '2aea54',
            '5d75c8', 'f42400', 'a4fc54', '632ea0', '42c1d8', '9e4f58', '30a32c', 'b9f76c', 'b71b00', '43b5fc',
            '520418', '52f83c', '58b114', '2ebae4', '1c9c38', '998aa4', '7b0624', '91e984', '4a62f8', '614658',
            '754d4c', 'd59f80', '57bcf0', '3dfd24', '8c30ac', '337f98', 'c65d40', 'bbdfb4', '7a1200', '3a2c94',
          ]);
        (instance as any).constants.dposv2.firstBlock = Number.MAX_SAFE_INTEGER;
      });

      it('should include at least once most delegates with vote > 0 in pool, in a long streak of rounds', async function () {
        this.timeout(100000);
        sha256Spy.restore();
        slotsStub.delegates   = 101;
        // 1 year...
        const numRounds       = 10407;
        let includedDelegates = 0;
        const delegatesMap    = {};
        delegates.forEach((d) => {
          const idx         = d.publicKey.toString('hex');
          delegatesMap[idx] = d;
        });

        for (let round = 0; round < numRounds; round++) {
          if (round % 1000 === 0) {
            console.log(`${round} rounds done`);
          }
          const list = await instance.generateDelegateList(round * 101);
          list.forEach((delegate) => {
            const idx               = delegate.toString('hex');
            delegatesMap[idx].count = typeof delegatesMap[idx].count !== 'undefined' ? delegatesMap[idx].count + 1 : 1;
          });
          roundsLogicStub.stubs.calcRound.resetHistory();
          getKeysSortByVoteStub.resetHistory();
        }
        const toSort = [];
        Object.keys(delegatesMap).forEach((k) => {
          const d     = delegatesMap[k];
          d.stringKey = d.publicKey.toString('hex');
          toSort.push(d);
        });
        toSort.sort((a, b) => {
          return b.vote - a.vote;
        });
        toSort.forEach((d, idx) => {
          const count   = d.count ? d.count : 0;
          const percent = ((count * 100) / numRounds).toFixed(2);
          console.log(`#${idx} vote: ${d.vote} inclusions: ${count} ${percent}%`);
          if (count > 0) {
            includedDelegates++;
          }
        });
        // Only one delegate has zero vote, so it should never be included in round
        expect(includedDelegates).to.be.eq(delegates.length - 1);
      });

      it('should include the top 101 delegates at least once in a short streak of rounds', async () => {
        slotsStub.delegates  = 101;
        // 1 day
        const numRounds      = 28;
        const inclusionCount = {};
        for (let round = 0; round < numRounds; round++) {
          const list = await instance.generateDelegateList(round * 101);
          list.forEach((delegate) => {
            const idx           = delegate.toString('hex');
            inclusionCount[idx] = typeof inclusionCount[idx] !== 'undefined' ? inclusionCount[idx] + 1 : 1;
          });
        }
        for (let i = 0; i < 101; i++) {
          const idx = delegates[i].publicKey.toString('hex');
          expect(inclusionCount[idx]).not.to.be.undefined;
          expect(inclusionCount[idx]).to.be.gt(0);
        }
      });

      it('should sort delegates by public Key if resulting weight is the same', async () => {
        const oldRandom                  = MersenneTwister.prototype.random;
        // We need to make sure to get the same weight for all delegates. (same vote, same random factor)
        MersenneTwister.prototype.random = () => {
          return 0.999;
        };
        for (let i = 0; i < delegates.length; i++) {
          const k = new Buffer(1);
          k.writeUInt8(i, 0);
          delegates[i] = {
            publicKey: k,
            vote     : 1000000000,
          };
        }
        const list       = await instance.generateDelegateList(32 * 101);
        const stringList = list.map((k) => k.toString('hex'));
        const excluded   = delegates.length - slotsStub.delegates;
        // Delegates with low-value publicKey are excluded
        for (let i = 0; i < excluded; i++) {
          const pk = new Buffer(1);
          pk.writeUInt8(i, 0);
          expect(stringList.indexOf(pk.toString('hex'))).to.be.equal(-1);
        }
        // Delegates with high-value publicKey are included
        for (let i = excluded; i < delegates.length; i++) {
          const pk = new Buffer(1);
          pk.writeUInt8(i, 0);
          expect(stringList.indexOf(pk.toString('hex'))).to.be.gte(0);
        }
        MersenneTwister.prototype.random = oldRandom;
      });
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
        'username', 'address', 'publicKey', 'vote', 'votesWeight', 'missedblocks', 'producedblocks',
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
    it('should call accountsModule.getAccounts with proper filter', async () => {
      (instance as any).constants.dposv2.firstBlock = 1000;

      // Still v1
      await (instance as any).getKeysSortByVote(999);
      expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        limit     : 101,
        sort      : { vote: -1, publicKey: 1 },
      });
      accountsModuleStub.stubs.getAccounts.resetHistory();

      // on v2
      await (instance as any).getKeysSortByVote(1000);
      expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        limit     : 101,
        sort      : { votesWeight: -1, publicKey: 1 },
      });
      expect(accountsModuleStub.stubs.getAccounts.firstCall.args[1]).to.be.deep.equal(['publicKey', 'votesWeight']);
    });

    it('should return an array of publicKeys and votes', async () => {
      const retVal = await (instance as any).getKeysSortByVote(1);
      expect(Array.isArray(retVal)).to.be.true;
      retVal.forEach((el, k) => {
        expect(el.vote).to.be.equal((testAccounts[k] as any).vote);
        expect(el.publicKey).to.be.equal(testAccounts[k].publicKey);
      });
    });
  });

  describe('checkDelegates', () => {
    let theAccount: any;
    beforeEach(() => {
      theAccount             = new AccountsModel({ address: testAccounts[0].address });
      theAccount.publicKey   = Buffer.from(testAccounts[0].publicKey, 'hex');
      theAccount.privKey     = Buffer.from(testAccounts[0].privKey, 'hex');
      theAccount.delegates   = [];
      theAccount.u_delegates = [];
      accountsModuleStub.stubs.getAccount.onFirstCall().resolves({});
    });

    it('should throw if account not provided', async () => {
      await expect((instance as any).checkDelegates(null, [], 'confirmed')).to.be.rejectedWith('Account not found');
    });

    it('should throw if invalid math operator found in votes', async () => {
      await expect((instance as any).checkDelegates(theAccount, ['*123'], 'confirmed')).to.be.rejectedWith('Invalid math operator');
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
      expect(accountsModuleStub.stubs.getAccount.callCount).to.be.equal(1);
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        publicKey : Buffer.from(votes[0].substr(1), 'hex'),
      });
    });

    it('should throw if delegate not found', async () => {
      accountsModuleStub.stubs.getAccount.onFirstCall().resolves(null);
      await expect((instance as any).checkDelegates(theAccount, votes, 'confirmed')).to.be.rejectedWith('Delegate not found');
    });

    it('should throw if trying to vote or unvote too many delegates', async () => {
      accountsModuleStub.stubs.getAccount.onSecondCall().resolves({});
      const wrongVotes = ['+deleg1', '+deleg2'];
      await expect((instance as any).checkDelegates(theAccount.publicKey, wrongVotes, 'confirmed')).to.be.rejectedWith('Maximum number of 1 votes exceeded (1 too many)');
    });
  });

  describe('calculateSafeRoundSeed', async () => {
    const height = 129353456;
    beforeEach(() => {
      // Make sure cache is clean
      (instance as any).roundSeeds = {};
      roundsLogicStub.stubs.calcRound.callsFake((h) => Math.ceil(h / 101));
      roundsLogicStub.stubs.lastInRound.callsFake((r) => Math.ceil(r * 101));
      findOneStub.resolves({ id: '1231352636353', previousBlockIDSignature: crypto.randomBytes(64) });
    });

    it('should query the db for the right block', async function () {
      this.timeout(50000);
      const seed = await (instance as any).calculateSafeRoundSeed(height);
      expect(findOneStub.calledOnce).to.be.true;
      expect(findOneStub.firstCall.args).to.be.deep
        .equal([
          {
            attributes: ['id', 'previousBlockIDSignature'],
            limit     : 1,
            where     : { height: { [Op.eq]: (Math.ceil(height / 101) - 1) * 101 } },
          }
        ]);
    });

    it('should return predictable and different seeds given specific blocks', async function () {
      this.timeout(50000);
      const blk = {
        id                      : '1231352636353',
        previousBlockIDSignature: Buffer.from(
          '81c4260ba54c5a9bfe186043500e7d6070dd8fc217a5e1d85ef33ee81c2b8381' +
          '8c7176212b86c751a8ce1aa4625880b77f2e772708e459f906520ff16424e016',
          'hex'
        ),
      };
      findOneStub.resolves(blk);
      const seed = await (instance as any).calculateSafeRoundSeed(height);
      expect(seed).to.be.deep.equal([2177115659, 2773244571, 4263010371, 1343126880, 1893568450, 396747224, 1592999656,
        472613761, 2356246049, 730253137, 2832079524, 1649967287, 2133751591, 149182969, 106041329, 1680138262,
      ]);

      const blk2 = {
        id                      : '783453461244634623424634513',
        previousBlockIDSignature: Buffer.from(
          '7d6070dd8fc217a5e1d85ef81c426086043500e33ee81c2b8381ba54c5a9bfe1' +
          'f16424e016880b77f2e772708e8c7176212b86c751a8ce1aa4625459f906520f',
          'hex'
        ),
      };
      findOneStub.resolves(blk2);
      const seed2 = await (instance as any).calculateSafeRoundSeed(height + 101);
      expect(seed2).to.be.deep.equal([2103472349, 2411861925, 3789053688, 474112134, 70582499, 1055398955, 2206317140,
        3316236257, 4049872096, 378014583, 4075254384, 2391568758, 556500679, 1370017306, 2757907545, 4177941007
      ]);
    });

    it('should return different seeds given different rounds', async function () {
      this.timeout(50000);
      const seed1 = await (instance as any).calculateSafeRoundSeed(height);
      findOneStub.resolves({ id: '987654321', previousBlockIDSignature: crypto.randomBytes(64) });
      const seed2 = await (instance as any).calculateSafeRoundSeed(height + 102);
      expect(seed1).not.to.be.deep.equal(seed2);
    });

    it('should cache the result', async function () {
      this.timeout(50000);
      expect((instance as any).roundSeeds[Math.ceil(height / 101)]).to.be.undefined;
      const seed = await (instance as any).calculateSafeRoundSeed(height);
      expect((instance as any).roundSeeds[Math.ceil(height / 101)]).to.be.deep.equal(seed);
    });
  });
});
