// tslint:disable: max-line-length
import { generateWallets } from '@risevision/core-accounts/tests/unit/utils/accountsUtils';
import { BlocksConstantsType } from '@risevision/core-blocks';
import { BlockRewardLogic } from '@risevision/core-blocks';
import {
  IAccountsModule,
  IBlocksModel,
  IBlocksModule,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { ConstantsType, SignedBlockType } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as supersha from 'supersha';
import { DposConstantsType, dPoSSymbols, Slots } from '../../../src/helpers';
import { RoundsLogic } from '../../../src/logic/rounds';
import { AccountsModelForDPOS } from '../../../src/models';
import { DelegatesModule } from '../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression no-big-function
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
  let constants: ConstantsType & BlocksConstantsType;
  let dposConstants: DposConstantsType;
  let pubKey: string;
  let votes: string[];
  let testAccounts = generateWallets(101 + Math.ceil(Math.random() * 200));
  // Add delegate-specific fields
  testAccounts = testAccounts.map((el, k) => {
    (el as any).vote = BigInt((1000 - k) * 100000);
    (el as any).producedblocks = 100000 - 10 * k;
    (el as any).missedblocks = k * 7;
    (el as any).delegates = [];
    (el as any).u_delegates = [];
    return el;
  });

  const totalSupply = 123456000n;
  let signedBlock: SignedBlockType;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-consensus-dpos',
      'core-helpers',
      'core-crypto',
      'core',
    ]);

    dposConstants = container.get(dPoSSymbols.constants);
    constants = container.get(Symbols.generic.constants);
    roundsLogic = container.get(dPoSSymbols.logic.rounds);
    accountsModule = container.get(Symbols.modules.accounts);
    blocksModule = container.get(Symbols.modules.blocks);
    blocksReward = container.get(Symbols.logic.blockReward);
    slots = container.get(dPoSSymbols.helpers.slots);

    // Init frequently used test values
    pubKey = 'e22c25bcd696b94a3f4b017fdc681d714e275427a5112c2873e57c9637af3eed';
    votes = [
      '+73e57c9637af3eede22c25bcd696b94a3f4b017fdc681d714e275427a5112c28',
    ];

    const lastBlock = {
      blockSignature: Buffer.from('blockSignature'),
      generatorPublicKey: Buffer.from(testAccounts[33].publicKey, 'hex'),
      height: 12422,
      id: 'blockID',
      numberOfTransactions: 0,
      payloadHash: Buffer.from('payloadHash'),
      payloadLength: 0,
      previousBlock: 'previous',
      reward: 15n,
      timestamp: 1000,
      totalAmount: 0n,
      totalFee: 0n,
      version: 1,
    };
    blocksModel = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    accountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    blocksModule.lastBlock = new blocksModel(lastBlock);
    calcSupplyStub = sandbox
      .stub(blocksReward, 'calcSupply')
      .returns(totalSupply);
    signedBlock = Object.assign({}, lastBlock);
    signedBlock.height++;
    instance = container.get(dPoSSymbols.modules.delegates);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkConfirmedDelegates', () => {
    it('should call checkDelegates and return the result', async () => {
      const checkDelegatesStub = sandbox.stub(
        instance as any,
        'checkDelegates'
      );
      checkDelegatesStub.resolves('test');
      const acc = new accountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
      const checkDelegatesStub = sandbox.stub(
        instance as any,
        'checkDelegates'
      );
      checkDelegatesStub.resolves('test');
      const acc = new accountsModel({ publicKey: Buffer.from(pubKey, 'hex') });
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
    let keys: Array<{ publicKey: string; vote: number }>;
    let keysCopy: Array<{ publicKey: string; vote: number }>;
    let getKeysSortByVoteStub: SinonStub;
    let sha256Spy: SinonSpy;
    beforeEach(() => {
      // Copy the original accounts so we can safely manipulate them
      const delegates = testAccounts.slice();
      // Create an array of publicKeys
      keys = delegates.map((d) => ({ publicKey: d.publicKey, vote: 1 }));
      getKeysSortByVoteStub = sandbox.stub(
        instance as any,
        'getFilteredDelegatesSortedByVote'
      );
      getKeysSortByVoteStub.resolves(keys);
      keysCopy = keys.slice();
      sha256Spy = sinon.spy(supersha, 'sha256');
      (instance as any).dposConstants.dposv2.firstBlock =
        Number.MAX_SAFE_INTEGER;
    });
    afterEach(() => {
      sha256Spy.restore();
    });

    it('should call getKeysSortByVote', async () => {
      await instance.generateDelegateList(height);
      expect(getKeysSortByVoteStub.calledOnce).to.be.true;
    });

    it('should call supersha.sha256 with the round string as seedSource', async () => {
      await instance.generateDelegateList(height);
      expect(sha256Spy.called).to.be.true;
      expect(sha256Spy.firstCall.args[0]).to.be.deep.equal(
        Buffer.from('123', 'utf-8')
      );
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
      let currentSeed = crypto
        .createHash('sha256')
        .update(expectedSeeds[0], 'utf8')
        .digest();
      for (let i = 0; i < expectedCount - 1; i++) {
        expectedSeeds.push(currentSeed);
        currentSeed = crypto
          .createHash('sha256')
          .update(currentSeed)
          .digest();
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
      const pk = new Array(101)
        .fill(null)
        .map((a, idx) => ({ publicKey: idx.toString(16), vote: 1 }));
      getKeysSortByVoteStub.resolves(pk);
      expect(
        await instance.generateDelegateList(123 * dposConstants.activeDelegates)
      ).to.be.deep.eq(
        // tslint:disable-next-line: max-line-length
        [
          '1',
          '41',
          '3f',
          '0',
          '42',
          '5a',
          '11',
          'd',
          'b',
          '8',
          '31',
          '5c',
          '4f',
          '1c',
          '15',
          '32',
          '3d',
          '25',
          '2f',
          '13',
          '46',
          '56',
          '29',
          '61',
          '58',
          '33',
          '38',
          '1f',
          '3a',
          '47',
          '17',
          '9',
          '43',
          'e',
          '2b',
          '36',
          '37',
          '24',
          'a',
          '30',
          '14',
          '4e',
          '48',
          '5d',
          '2',
          '28',
          '2d',
          '39',
          '64',
          '26',
          '3c',
          '3e',
          '19',
          '23',
          '1e',
          '44',
          '34',
          '57',
          '2a',
          '3b',
          '5',
          '1a',
          '27',
          '2c',
          'f',
          '59',
          '6',
          '40',
          '4b',
          '45',
          '4c',
          '1d',
          '7',
          '49',
          '4a',
          '53',
          '2e',
          '18',
          '4',
          '60',
          '54',
          '10',
          '5e',
          '12',
          '50',
          '1b',
          '21',
          '16',
          '5b',
          '3',
          '20',
          '62',
          '55',
          '22',
          '52',
          '5f',
          'c',
          '35',
          '4d',
          '63',
          '51',
        ]
      );
    });

    //   describe('dposv2', () => {
    //     let delegates;
    //     let seedGenStub: SinonStub;
    //     beforeEach(() => {
    //       (instance as any).constants.dposv2.firstBlock = 0;
    //       // we add delegate.id for easily mapping them
    //       delegates                                     = new Array(202).fill(null).map((a, idx) => ({
    //         publicKey: Buffer.from(Math.ceil(10000000 * idx + Math.random() * 1000000).toString(16), 'hex'),
    //         vote     : Math.ceil((201 - idx) * 10000 + Math.random() * 999),
    //       }));
    //       delegates[201].vote                           = 0;
    //       getKeysSortByVoteStub.resolves(delegates);
    //       roundsLogicStub.stubs.calcRound.callsFake((h) => Math.ceil(h / slotsStub.delegates));
    //       roundsLogicStub.stubs.lastInRound.callsFake((r) => Math.ceil(r * 101));
    //       findOneStub.returns({ id: '1231352636353', previousBlockIDSignature: crypto.randomBytes(64) });
    //       seedGenStub = sandbox.stub(instance as any, 'calculateSafeRoundSeed')
    //         .callsFake((h: number) => {
    //           return new Uint32Array(
    //             crypto.createHash('sha256').update(`${h}`, 'utf8').digest()
    //               .buffer
    //           );
    //         });
    //     });
    //     after(() => {
    //       (instance as any).constants.dposv2.firstBlock = Number.MAX_SAFE_INTEGER;
    //     });
    //
    //     afterEach(() => {
    //       seedGenStub.restore();
    //     });
    //
    //     it('should produce the same array, given the same round and delegates', async function () {
    //       seedGenStub.restore();
    //       this.timeout(10000);
    //       slotsStub.delegates = 101;
    //       const roundNum      = Math.round(Math.random() * 1000000);
    //       const list          = await instance.generateDelegateList(roundNum);
    //       const list2         = await instance.generateDelegateList(roundNum);
    //       expect(list).to.be.deep.eq(list2);
    //     });
    //
    //     it('should return consistent data with precomputed i/o', async () => {
    //       seedGenStub.restore();
    //       findOneStub.returns({
    //         id: '347457463453453634',
    //       });
    //       // DPOS v2
    //       const pk = new Array(202)
    //         .fill(null).map((a, idx) => {
    //           return {
    //             publicKey: Buffer.from(((idx + 1) * 1000000).toString(16), 'hex'),
    //             vote     : 10000000000000 - (idx * 1000000),
    //           };
    //         });
    //       getKeysSortByVoteStub.resolves(pk);
    //       const bufferList = await instance.generateDelegateList(1001);
    //       const stringList = bufferList.map((k) => k.toString('hex'));
    //       expect(stringList).to.be.deep.eq(
    //         // tslint:disable-next-line: max-line-length
    //         [
    //           '17d784',  '2bde78',  '7270e0',  '1e8480',  'ad9198',  '57bcf0',  'aab52c',  '97a25c',  '375028',  '29020c',
    //           '1ba814',  '487ab0',  '7a1200',  '3d0900',  '773594',  '5b8d80',  '3dfd24',  'a12bc4',  '2160ec',  '614658',
    //           '8e18f4',  '3567e0',  'ae85bc',  '43b5fc',  '7bfa48',  '2faf08',  '7cee6c',  '42c1d8',  '328b74',  '895440',
    //           '1406f4',  '4b571c',  '29f630',  '7ed6b4',  'b9f76c',  '1d905c',  '6dac2c',  '8d24d0',  'b532b8',  '501bd0',
    //           '95ba14',  '90f560',  '234934',  '92dda8',  '623a7c',  '206cc8',  'c0a468',  'a8cce4',  '7a1200',  '4d3f64',
    //           '243d58',  'bfb044',  '1c9c38',  '989680',  'baeb90',  '365c04',  '791ddc',  '998aa4',  '717cbc',  '40d990',
    //           'a5f078',  '69db9c',  '8a4864',  '6bc3e4',  'a7d8c0',  '5e69ec',  '4c4b40',  '54e084',  '47868c',  '14fb18',
    //           '38444c',  '6acfc0',  '876bf8',  '112a88',  '660b0c',  '56c8cc',  '91e984',  '510ff4',  'b80f24',  '90013c',
    //           'a4fc54',  '895440',  'a7d8c0',  '7b0624',  '41cdb4',  '764170',  'd59f80',  '9c6710',  '520418',  '68e778',
    //           'e4e1c0',  '3a2c94',  '8f0d18',  '1ab3f0',  '3d0900',  '7de290',  '8677d4',  'b71b00',  '6acfc0',  'f424',
    //           '19bfcc',
    //         ]);
    //       (instance as any).constants.dposv2.firstBlock = Number.MAX_SAFE_INTEGER;
    //     });
    //
    //     // it('with real data', async function ( ) {
    //     //   // tslint:disable-next-line
    //     //   delegates = [{"username":"official_pool","rank":1,"vote":"236405891107834","publicKey":"7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0"},{"username":"sio34","rank":2,"vote":"220375055683806","publicKey":"7f47eb8161678a776d63d100508bf5bb5865361481e3054428c66ab9432b2b01"},{"username":"jan","rank":3,"vote":"208127176748655","publicKey":"e433144892f40c838d0ea865dde0915e4fdaecf3521efef585ff306e6513c8fc"},{"username":"trnpallypool","rank":4,"vote":"181791087963404","publicKey":"029c5489b5e3f7951028b07c2665dedc2072c5454982b945e8d4a24e6a789828"},{"username":"gregorst","rank":5,"vote":"147720956573102","publicKey":"517db3e30b8edb40647fe49f0f595b0f57d0cb42b58b0022301b8a0757a83eda"},{"username":"viking_pool","rank":6,"vote":"145684903315615","publicKey":"f4307b1f23630776dc621302ad45cee063bffc4140de00a501c85d6d3abeb980"},{"username":"risegallery","rank":7,"vote":"125319304476665","publicKey":"114c7066fc43ec01ac2f40f590d993bd20b3793dc82e5583927cf1521b5bac87"},{"username":"cct_risearmyx","rank":8,"vote":"124671591735030","publicKey":"4e2187d3b9dc2d97a024434713274a4781b5966cdf22e108abbed5d540871d85"},{"username":"cct_risearmy","rank":9,"vote":"123613918225869","publicKey":"80607b18952b4fd61a741915bb414a5028f25def8469c15392a16c3b1c131f6e"},{"username":"risearmyxx","rank":10,"vote":"115409368538138","publicKey":"df06ac715314397ae7736d0ad448c6524dc89752ee41147bc6b7dd44948bd8b1"},{"username":"anjalee","rank":11,"vote":"111779454647414","publicKey":"16d725d3430beb17638397f48c66f035ed25ddcc02220ab3d311b6a0a3d8f349"},{"username":"danoob0","rank":12,"vote":"108341425793384","publicKey":"b90804b97ff7b1a84902897647d3f1aaea94f530bc4ee433752fb39b7eb30910"},{"username":"sith","rank":13,"vote":"106562649180267","publicKey":"939499282da94806b144bd11463063b8b2377f3a3c6cdebc47e3268debfec108"},{"username":"jedi","rank":14,"vote":"104721301066283","publicKey":"fb777a8adef5d62ecc0b7e130f7da03b1c6b395a59281d4979cd6f329d6098fd"},{"username":"yoda_pool","rank":15,"vote":"100991084422927","publicKey":"655e4cbd91e618cd77090c0c2b56e9df02093008a00d7daf77b04379142c3d82"},{"username":"maxwell_pool","rank":16,"vote":"99274950037892","publicKey":"c3bf0d2e95d2eb2479ee338915d72430a114c509c453ef21d8a07d6b9a564c19"},{"username":"multiverse","rank":17,"vote":"99100885843833","publicKey":"af77750c7660a8b4a187688702d241bf6318b025ee2aae1f7abddd6444239dad"},{"username":"rise_pool","rank":18,"vote":"97609313448025","publicKey":"042d2f65557e52e219d3cd53c5ea33b6e09bc09529c874beb73cede1262cfb93"},{"username":"maxwell_pp2","rank":19,"vote":"97523629695864","publicKey":"02c46ec79b9a81f97377b4bc3f23108e1c81b0676a4e5327e4201d1bee630daa"},{"username":"dts","rank":20,"vote":"96370463804438","publicKey":"70a9c5555eea50685f4c081f81e692f70416ec1a032154ded8f8e0f3ecfadab7"},{"username":"zen","rank":21,"vote":"95560584516780","publicKey":"04f3622da4443fb6584ddb96ccd592f7efc0c679c71fe3bab75472a0129d8779"},{"username":"anamix","rank":22,"vote":"94913505653982","publicKey":"a0e56324a9d4d9d0d845824e664487db5b880b423ff2dd393b43af21cc274f23"},{"username":"riser1co","rank":23,"vote":"94679921116773","publicKey":"25b51a18f6e90d8436ee1b5ec67cf9eaaf4273d0f9501e7f42e185e8fbd36033"},{"username":"hybrid_pool","rank":24,"vote":"94180559011186","publicKey":"05e5b4cbe7aa75eaf80cca6a085a35f5f20be68e1d08b98b1dd32b2c108fc328"},{"username":"rise_vip","rank":25,"vote":"93985329651337","publicKey":"3138cfc2b1fd369c8d6b46b71d195180611e9322b926325f1f082af356836868"},{"username":"stefanoproxy_pool","rank":26,"vote":"93806151141410","publicKey":"73af180fdb1754490fa73dfb800b982df9c445ea5304f65f4b26abc8b2c315e8"},{"username":"d.h","rank":27,"vote":"93060652632567","publicKey":"7aa47589efa3089969ffa62ea67d05fb89b1772a279ae950c186785768907408"},{"username":"riserider","rank":28,"vote":"92096310342234","publicKey":"215e91ad97c027ae2e0fcfa965ecf3f9af412060a94559b8ff8b7b9c4f73381a"},{"username":"openbitlab","rank":29,"vote":"92082739369845","publicKey":"c7fc699fa4feabb3709f12c08121ee890ec30ffa379eaa248827a8c4d30bdef7"},{"username":"therisepool","rank":30,"vote":"92027247541435","publicKey":"5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde"},{"username":"amar","rank":31,"vote":"91060440369435","publicKey":"f48d33887c6eeb6703d5ae6564c1f358229feb0ae4607394013c68ab13af6ea3"},{"username":"omz","rank":32,"vote":"91013594864486","publicKey":"a1b7b66cad48f84c9ff348ea39cb88fde47f75e4dcd652acaf30de32d54dd9d8"},{"username":"xenior","rank":33,"vote":"90864771752767","publicKey":"06aba7912d97d04eea4315313bc060e2780b1de278ede5ff35a5d087dbc2c349"},{"username":"mercy","rank":34,"vote":"90830022178372","publicKey":"dbceadd35b07b1a5dfb1e14b5d294775401b595282a51f5ba662b30031c82d7a"},{"username":"zed7","rank":35,"vote":"90541814356516","publicKey":"cf37c85871c8965a0c0cd0499fc3ebaa9316654a6aec58534fcfa70fb5ab135d"},{"username":"d.e.n.n.i.s._system","rank":36,"vote":"90355357953565","publicKey":"411d3a84ecdfc4115c12e0802345bd7c821ee3b20dd536deccf521fee3965722"},{"username":"korea","rank":37,"vote":"90305237009111","publicKey":"ef3c4554a4ab9e581c88d8b4826eff955dde027239b4899304552d83d20dc897"},{"username":"dreamtheater","rank":38,"vote":"90105212376482","publicKey":"86f60824dd73237822a21241388b97b37cc68750d958ef6d0607cc098f68d65c"},{"username":"mumu","rank":39,"vote":"90064592871112","publicKey":"e77543f387aca605d99ed9bd2b04cdb0f5befdc876971789e7071482b0ce6b8a"},{"username":"rise_inside","rank":40,"vote":"90055157236778","publicKey":"bd4daf03dcec2800dbe3e18b133b2213d3a232c1cc4db9e7092866fd23b666d2"},{"username":"roulette","rank":41,"vote":"90006933104325","publicKey":"e0006732649c9890eddbbcba891e2b55bee6d860ca85d98962f326a6c8b5bdd0"},{"username":"risedad","rank":42,"vote":"89975008406306","publicKey":"a4418a28426b775f949f0530d09d0a68176baa1cfef87dd23af9e6d23256e63e"},{"username":"cct_risearmyxxx","rank":43,"vote":"89514224689008","publicKey":"9cd840f63a2d5a5d4b45afebd47ec0bfab0e66f660f0ff58ffc7237567bde991"},{"username":"dr._mantis_toboggan","rank":44,"vote":"88872076871856","publicKey":"8ffd51cde5eee2d58313e0f3cb4160287eb369f8dad9ba8a2128a839cce70d96"},{"username":"coinbang_b","rank":45,"vote":"88592973891207","publicKey":"e224e7818099214b7819fac28fa0107a2af1fc24b27cf1db817076e071325c39"},{"username":"supernova","rank":46,"vote":"88295332231597","publicKey":"1413fc21fb3caa48a934b81e04f4a57b8e4042c255f3738135e1e4803dd146cb"},{"username":"risevader3","rank":47,"vote":"88270366630200","publicKey":"fd088b1aeaa414390eed0770d959226e8be945ecd0b275ccf08fb06f7d23249d"},{"username":"alphago","rank":48,"vote":"88252628334166","publicKey":"3318be98f72351dec3d9e180f349817e0dca91ffebf1cc208cd36a716cc3126a"},{"username":"pizza","rank":49,"vote":"87701447392389","publicKey":"dfd37e9eb9c0e1e589ecd0df9c6554ed0279b3f67f2b8c6fdd2e141da309f61b"},{"username":"jupiter","rank":50,"vote":"87688906080277","publicKey":"a898f17e51eb4671b2dafdc8d7b6d27234a65ee70402146c978b3d6cd525cec7"},{"username":"daenerys","rank":51,"vote":"87523781310056","publicKey":"71d217dd81549314e9a269ac6f7d7e3ec98c4763e88a5d93b91ff384197813e0"},{"username":"lexus","rank":52,"vote":"87492339649711","publicKey":"37831fe92d110d1279b02528ca95d89bcfd486ddf465660924eb2e103acd964d"},{"username":"nomoredollar","rank":53,"vote":"86898875468984","publicKey":"7b81a3cc4272c406b450b46cddcc680c2a76b356a5bb9718dbd78e3822e95579"},{"username":"coinbang_a","rank":54,"vote":"86897672178223","publicKey":"a2b7c104544956e7046e82ee8e50f5e5c06214b6d985336b85cfe65c34c56d13"},{"username":"bonsai","rank":55,"vote":"86732097151970","publicKey":"255f60b0642d60ac83427ce5bf8f63e55d634437eec06379aa07cd3025afd717"},{"username":"cacao","rank":56,"vote":"86633920931579","publicKey":"34f374d4d19e6ddddea6ec39a20024c515066292d3562983d25045e3625f7c4a"},{"username":"snowman","rank":57,"vote":"86575777524679","publicKey":"de122d40cb2d7708d121b2dbc9f1094663e407a37003e0bd9be0474d8494774c"},{"username":"denden","rank":58,"vote":"86544367037315","publicKey":"6e74ad6e693ec13fd746b4cba9a0df60fdc5d3c234b43642697f491dd190b0e0"},{"username":"coinbang","rank":59,"vote":"86536698463344","publicKey":"67f8a136956c0db4c5225517b17877e1f3044ae4e77631e8af8cb51cf232a1db"},{"username":"goldengate","rank":60,"vote":"86458950154600","publicKey":"ff6ff0bb13330e7e25b78eba1d4bbd91f46a58f33d5cfb0791a684fa5f0b811b"},{"username":"maxwell_pp","rank":61,"vote":"86447710621822","publicKey":"75c3a2ffee959148cab26fdcc9591251c54e1f49436c869cff4d57ababcfe146"},{"username":"ucc2","rank":62,"vote":"86340856755896","publicKey":"150eb0af5070cb6f3f8e5e882572441498bf5a6d0387f8d13e3d70562260b82a"},{"username":"southkorea","rank":63,"vote":"86279994448333","publicKey":"b481e38ca5ac6d4db9ad220306d451614aa1603419451d5eaf1eb49db00f18a4"},{"username":"ccgut","rank":64,"vote":"86096960890787","publicKey":"342d724454d23335368c2a7edd7a391848b340db1c9c95db96e62e337149a038"},{"username":"pickles","rank":65,"vote":"85952005446696","publicKey":"39c1d540a604649ef3a9504e1585f9e66efd8255e17b8c4a14d61c9a9b5e9465"},{"username":"risedon","rank":66,"vote":"85889811980142","publicKey":"c4045136dfa31d924aa320f2f7d46463feac64806ad34081e34c6ac38cef09cb"},{"username":"pinot","rank":67,"vote":"85874694088332","publicKey":"c5f146d9b5586a221595c3436319bd88982833d910e671d6046ace8cc83b17bf"},{"username":"paris","rank":68,"vote":"85780056159013","publicKey":"976b9f0c87004fee662de6bdccdbe22125a0de04cb4692ead9c713bd4a201380"},{"username":"shads","rank":69,"vote":"85748090576120","publicKey":"617fd5cb558d8c4c520271079a8dabf41219efec85973c2d8663819d077b8ac3"},{"username":"tjkgaming","rank":70,"vote":"85624707712697","publicKey":"696a15b1e89a1e9b22858500d982095f4bfbf315b337f6181a6f278602340577"},{"username":"smart","rank":71,"vote":"85469944821414","publicKey":"06574e54e0c7f23146aa60b4b61a6a642a9f0a608c66dc4228acc0861dcb013d"},{"username":"rise1x","rank":72,"vote":"85386746874007","publicKey":"1f0790c944397e897a5379600359bb135f4cc29b0d0271e4bc7b8ca5a6d8ef7d"},{"username":"bubbleb","rank":73,"vote":"85326958316846","publicKey":"0134394f4789bade973b36d4c4302eb9156b56a1723f4d4a8e150805a2be583e"},{"username":"realnoah","rank":74,"vote":"85291003762457","publicKey":"d1425be32dc57e796dcda45627130853570b45c3f6c371c16179e77d0b7c5438"},{"username":"alessia","rank":75,"vote":"85286899871000","publicKey":"b45f17074794794c5ecc4892a13b29c6b5c7c59c52be6b3a5b0cc160f82a49cf"},{"username":"lumberjack","rank":76,"vote":"85285442849471","publicKey":"301bbd3756c3e9e51f4d70de884f0f9fa97f0eb63f792306c68055d9f816c844"},{"username":"jane","rank":77,"vote":"85279721022658","publicKey":"80ef544d87ada767c24a94b57a92ce98509c552deb1040c55eac1cf598f64ff2"},{"username":"greg","rank":78,"vote":"85254780503694","publicKey":"073e51768cc91dd91f1031edca9bd7127736332dfa06f3449347db0877140174"},{"username":"spookiestevie","rank":79,"vote":"85212151602743","publicKey":"8d26323cc49a312dd22aede7fcff8bc8924bb30b3e1ddede39043cb13826a4f8"},{"username":"asgard","rank":80,"vote":"85196469489124","publicKey":"e935a64250b08c60a48951388a881647426e5aea5288e065783ac5a4b288bde1"},{"username":"drusilla","rank":81,"vote":"85029632272461","publicKey":"acdc7b60a1d7bfe50be588bfa44345b878a400fb2827ef4f7951eaf47029cc56"},{"username":"johnburr","rank":82,"vote":"84972589805168","publicKey":"b36bd4b9be92425ba16c300fbbf649fbed6090cc46cb3540498491b4ab48e008"},{"username":"valhalla","rank":83,"vote":"84628639147383","publicKey":"8786543de4cf3aa09d1f17e046cd43bfb143ff7a7a8bd1d0a091fe0279d722c5"},{"username":"mr_mojo","rank":84,"vote":"84558272298246","publicKey":"c849616c03c876f4d01619c02f2a196bf0b83d5710512a0d0b57f1875a43db4d"},{"username":"koreapas","rank":85,"vote":"84529308480846","publicKey":"c1e60c0baa9c3ff7e50e46923b567844cb47ffa18a6b8c8ea9ba6b45f1eff637"},{"username":"official_pool2","rank":86,"vote":"84358822341252","publicKey":"464fc2389553c93cead6ae5681313245f74f7900c0f55cf8aa3b56c5fe132d8b"},{"username":"ucc","rank":87,"vote":"84093676426311","publicKey":"900958d7ffc7db30f09f1fbbc232e717ba0d7125997d786643ee7edcf22df517"},{"username":"archer","rank":88,"vote":"84053759093103","publicKey":"8d6bb4dec751120759e13253419c9165a19ce70601e2279beb363627882ee69b"},{"username":"elblanco","rank":89,"vote":"83784678124181","publicKey":"14072df4b8530154f3a38d8d8d1bf448ee65684adebc3a1caaf7051ab4aeb521"},{"username":"cooper","rank":90,"vote":"83393378217632","publicKey":"3e4fb9783d8d80ab2965c45ef253e34902f3723e90f5e5e6fc81f0806dc3138d"},{"username":"corin","rank":91,"vote":"83362054548097","publicKey":"978647d2536f640b98cf98c8d37d6773bec08a6116daecb63f29d04d2d07ccd1"},{"username":"jamesbond","rank":92,"vote":"82503061535227","publicKey":"da03aa8bd684eb0b9c62206e284d74e9361d4a2fb8e90c6ee0bd31b79ff56f3f"},{"username":"dorito","rank":93,"vote":"82348745701539","publicKey":"19b2f3174aededde2822122f2a052eb9e7853c9f594c5521b3909e31d9ed5f63"},{"username":"grandcanyon","rank":94,"vote":"82277713690120","publicKey":"35257becdec0f703f904b0681267c1044e624b22a137961919f6b61ef9075bdc"},{"username":"tesla","rank":95,"vote":"82249071377980","publicKey":"c0ce656b31f6f579ed797a78b2ee4038dd887a2b15c5b13067ef94cc34bb8efd"},{"username":"eastwood","rank":96,"vote":"82235894686920","publicKey":"e3a3de923656e2b94ac8fc8933999fde76dd2cf57d6c0eacc2767044414a2672"},{"username":"cleopatra","rank":97,"vote":"82032805248955","publicKey":"0b6b6440aaff05e9d006fc1a8a090b1ae4b5ad267e3bff1279f458e57289f121"},{"username":"chobo","rank":98,"vote":"81578450076273","publicKey":"50f75fa1855f682bfe1a5b98c1fbaf0764babaf751931ee8dc464fc64eace9c2"},{"username":"tiesto","rank":99,"vote":"80371066227121","publicKey":"881f4b2e5a875e6fef2071eba3f5a19c943ac869e485668e5dea244aa2baa7c3"},{"username":"indianajones","rank":100,"vote":"80336475823402","publicKey":"a65a8160b1e0733f66d1f1a8f322c9af29b26d5e491a84d6e3ae0ec43e000446"},{"username":"will","rank":101,"vote":"79185036757681","publicKey":"feae1951331c1c00e6bdb4c8deda9a7f28f1c5b7f555b58aacf16e2a8796271b"},{"username":"gazua","rank":102,"vote":"79174137567992","publicKey":"0b7bb40385c5261c8cc763babebc9ccf9d392e618dc15104db5efb1c6a5719ee"},{"username":"coffee","rank":103,"vote":"63826150791091","publicKey":"b3868ed678fdb600da1a8f7e5768f85a95fef43c2779e32ca9022ea738e55cf8"},{"username":"axi","rank":104,"vote":"51975408274043","publicKey":"347830b9de2b61e752044640efbdf80b32c8cf50511eeae73d7142cce50ad075"},{"username":"everest","rank":105,"vote":"37308760251275","publicKey":"f89514edc7653e70097ff279de1e293c4aead8909d8c97cb9444d1a210e78558"},{"username":"risebrazil","rank":106,"vote":"34792571985346","publicKey":"afc54e255e1ab0963bbc87602dbd252a79e2de16b78b3edf289f6700cc4ba87d"},{"username":"corsaro","rank":107,"vote":"28313467341715","publicKey":"be3c9ed52dd151f9236d858e96e1682c84931ac774736700277b51ea15784512"},{"username":"dpos","rank":108,"vote":"26888619306903","publicKey":"df9a92c4f1d8dc9bb022474ce548467a0e5d5565e16810a3c0f3ee8f1d7d0cf4"},{"username":"bloke666","rank":109,"vote":"24423906636484","publicKey":"5a754e38e2bf341360e4c8cef1263179020e8db431443fc59fed203f2d6728d1"},{"username":"torrent","rank":110,"vote":"23690883224704","publicKey":"c13552788618376887683fee21819c13dd958fabba912b12067000e4363d33b9"},{"username":"arrow","rank":111,"vote":"6003871112106","publicKey":"466e2133d76db27ed949a7468a25a5828cc90b6b33938c87d2f7989476525d47"},{"username":"bilibilibang","rank":112,"vote":"5996750000000","publicKey":"ff9fae2306a323bc350e77e6d72686a41e8a7cfb162f6b38936648dad9c8a246"},{"username":"starlord","rank":113,"vote":"5313047748595","publicKey":"7a3c109b161e95bd63390346f9a25f04f1f9517df8613cb55d68d62099041fe6"},{"username":"doom","rank":114,"vote":"3711321626180","publicKey":"0275d0ee6f100cd429bbdc8556e3d1f49cca610f093c2e51e02cf038e8813282"},{"username":"4miners.net","rank":115,"vote":"3466713762336","publicKey":"2590ec2703bc2ecc2ae6f31c577f0e48d19cb815b9059a47c9b22b5d0ddb5c73"},{"username":"wolf_cola","rank":116,"vote":"2381267029467","publicKey":"65bcbed8eb12e499a3a6f3ea29a33a7fd31cef1e2816b01f52b48ae18d63af27"},{"username":"risevader4","rank":117,"vote":"1333350405247","publicKey":"1a6380ed392798512e6b3cdbb90f5dcb852816c2c721e8dfc28a3c8f11e17bef"},{"username":"renos","rank":118,"vote":"1100736248128","publicKey":"47fa3a3a520b3af0cc33b90d288ef40a0ce0cd7aecc59c63937728dc359da1ed"},{"username":"hirish","rank":119,"vote":"997400000000","publicKey":"1771f2fb277b92fe807aca7cbc59b06d0353d505818e0abb4b96859820ee93a4"},{"username":"polygonlagoon","rank":120,"vote":"799990000000","publicKey":"24131cba9148c93a47ffc91d626320862d9887b3b330be7d4e4de6ce0de0e644"},{"username":"spuushie","rank":121,"vote":"606291680376","publicKey":"c66f34b211e0c26e109de06dc2f1c61346cbd3045a9df166975d2e173bff41a9"},{"username":"sabakizin","rank":122,"vote":"559684993655","publicKey":"91903be2c29c3ba61679fa84851f6f3c10bf7dac7694a23416439ec5b654ba32"},{"username":"chamu","rank":123,"vote":"417360661681","publicKey":"cfbb3be473ed479604f27a2f95bc777baca3cb9afe78aa66c634d80128f3d773"},{"username":"jiren","rank":124,"vote":"413686938993","publicKey":"3421738ff785c87074fc27682b319679379231873dc2721e5989fc748d495580"},{"username":"patjar","rank":125,"vote":"396890000000","publicKey":"335be33a8596237c388577620837da831281895450cc275d76b0b3de4b7cece9"},{"username":"riseforger","rank":126,"vote":"311624986624","publicKey":"dd2687f34db54708c4c4e0fdfd27e43d64785b3e57d14f1ac7849b78cd4e3e98"},{"username":"lokesh8","rank":127,"vote":"310342255007","publicKey":"ed8acd72314e9e292c784f8f3f08c6abf859f9581e12eb93aa9b315e80e89f50"},{"username":"genesisDelegate15","rank":128,"vote":"300095389300","publicKey":"fffff45c1aea95e32a96ee396175cfff9b6797f52f1eac5cdc832eec54e2e1b2"},{"username":"luisfdo1986","rank":129,"vote":"299445000000","publicKey":"f8736f55c5a4f249782b11d4a5c30f675dd40adfc106b6357aaeb297c262bbfc"},{"username":"vbuterin","rank":130,"vote":"279108308143","publicKey":"ffdd7a05e39b6bd9d7f3ef420b8bdad4b8bca2f632027e0553ffe6e4eafba8e6"},{"username":"cozacrypto","rank":131,"vote":"222360000000","publicKey":"8c8ba9a346f60320acabc90be3b91eb8f64ccdbdda0bc5cb9121bfa00d257546"},{"username":"00000000000000000000","rank":132,"vote":"210766636237","publicKey":"daab793b1134cad9135a232d4774625da6e2d9bc3273e11ed25fd839c46c4c5a"},{"username":"rickety_cricket","rank":133,"vote":"209154950626","publicKey":"d9761e0b6d33b480d514ab3b6fbe0ea536d340b8980abb1f64f1c3ea3163a06c"},{"username":"risearmy","rank":134,"vote":"204880000000","publicKey":"15a63292f2402f6e6a5d5fc325a15b877d878061ac80419c7787269306a1c05b"},{"username":"boobs","rank":135,"vote":"199900000000","publicKey":"351961fb5f21553f7bb6072fee75cbb3f60678baeae5ffdb60a71da7f50e5989"},{"username":"bubblebx","rank":136,"vote":"177415346743","publicKey":"e67c007dde9750b7913ad5ea9eb281d1bf41fc2c551634b69400c47dcc709f76"},{"username":"whitedragon","rank":137,"vote":"171322204595","publicKey":"9942452a529cc6fab205a620f74393fce7c6e4a8d2d575ae5072bde83a5b437c"},{"username":"satoshi","rank":138,"vote":"167414720649","publicKey":"43e8273ff376f6eeaec17df5ce7821d205f71d9d2cfde690df853f6af7966def"},{"username":"seatrips","rank":139,"vote":"149709380225","publicKey":"0e0426cf903ee24b2a39cd8f21bd8117aea5a2d2128ebdaabfa558376dc58933"},{"username":"longtrader1980","rank":140,"vote":"148150000000","publicKey":"2dbea33b9c074dc732b77c4bb11bd052d7952f448ce4baf762fafc07021ef5a9"},{"username":"gregoro","rank":141,"vote":"130211817340","publicKey":"03f3bbca5f11819bdc9d4f51935431df79a0112fd1188a251085a10c0eed32f6"},{"username":"sioduke","rank":142,"vote":"128430000000","publicKey":"e61329cb9f6ba2141b17383323331a5001daa5d61646bf0565825597ea7bd455"},{"username":"goat_master","rank":143,"vote":"123650092593","publicKey":"cb01142fe9983afceed30c17b787400459950e9ae6d3bb4778ef5aa384c76a69"},{"username":"buy_eos","rank":144,"vote":"101250000000","publicKey":"c9d7fcbf85eedb436eeb3079ccc315d9dd13b9d1f5f280ef15d4f5b1595fae45"},{"username":"hknatm","rank":145,"vote":"97400000000","publicKey":"2911f342d81f9e96c71177624fb985e81f15906282b63dcd9fe1105e99b12998"},{"username":"snatic","rank":146,"vote":"67498415644","publicKey":"d85ab6061c39ff31d978fecbf2fc6f50d80254baf273b45c9163e19bb26326a4"},{"username":"swimming_pool","rank":147,"vote":"60784869598","publicKey":"9c32f6e25f62ddcc1afdf4e5b031b16bcc9d4ecb93932a37b7f36ca3d6bd223d"},{"username":"riseangel90pcshare","rank":148,"vote":"48825613257","publicKey":"853868adf13a4a1654706c40ebee0b06a239b10bf3f780a70ba5885ae18a1fbe"},{"username":"petescgn","rank":149,"vote":"40668524048","publicKey":"faede05346dc21766337a00b4821c0f74b08d14cf9c744116571f00223dc34bc"},{"username":"genesisDelegate87","rank":150,"vote":"37955148516","publicKey":"e99d803f628864c8254c0e6667d025714044d666f9e39a96b3faf1d9e04bb886"},{"username":"genesisDelegate22","rank":151,"vote":"37855544541","publicKey":"1c8943912329ff567c6bcb648471016ceafee074607a38b79e7f673a9f887141"},{"username":"ondin","rank":152,"vote":"36606285334","publicKey":"55ce9fc4a3b45fa6c2e02e8bb00bad9ae7166d25c9e9efdaaf4adfa34b10d9d7"},{"username":"genesisDelegate49","rank":153,"vote":"36603663416","publicKey":"0158c0943f2a99fc9a6d044fb51c81c12212a250351ef491b0322342e24dac0a"},{"username":"genesisDelegate47","rank":154,"vote":"35043069295","publicKey":"04aa1e2e8db76989e5be53777cc6c94fd0417cacb95f03d67456e9df69543659"},{"username":"genesisDelegate85","rank":155,"vote":"34955643557","publicKey":"f7e091e816852d8ba837154e3d50a4d501c9b68ab17c64843653ae445e10b83d"},{"username":"genesisDelegate77","rank":156,"vote":"34818415857","publicKey":"e3bda83fb34123ee779e3255902936a50317d9abbc74ad02539d813f61bd6778"},{"username":"genesisDelegate48","rank":157,"vote":"34818415830","publicKey":"66c7d8cbf12fbb90fdced6156fc171072ef912ab5a9a145a75ab42c5e3b17e10"},{"username":"corre","rank":158,"vote":"31400000000","publicKey":"76da465c6944ed2a3d163214a53cb3decd1d9d335e64f9b64e452cded60a52a7"},{"username":"ri$e_nation","rank":159,"vote":"31020451649","publicKey":"9da468ab41e770d5ed9c79a9b6957c719ab482a864b6cee7b01a33447a2232f7"},{"username":"sempaibfr","rank":160,"vote":"26380000000","publicKey":"86cc036b7edc7c82f0b645e86a7ce2eeeaf7a4e080d62d2b42a1d90160acdd57"},{"username":"genesisDelegate42","rank":162,"vote":"22390594052","publicKey":"036aa0d1786000f6f69e6855c2c8e179d07e46f56ed5ec896b46e9d145a5a7eb"},{"username":"genesisDelegate41","rank":161,"vote":"22390594052","publicKey":"02977d87b7ccf8aa665f8cbe7ed141d01788db2706d900ab0a90f4cc625be6a6"},{"username":"genesisDelegate24","rank":164,"vote":"22390594052","publicKey":"0676e4f3a32bcba9e28d6a57b593ac88f11412a21a66456a502e4ebf767a5959"},{"username":"genesisDelegate28","rank":165,"vote":"22390594052","publicKey":"073b61bcf3b8e9b66248399f0e8beea579f94b47be719d6b6b39dc647ae5f646"},{"username":"genesisDelegate37","rank":166,"vote":"22390594052","publicKey":"073dc27c39a376c3d90bc46bd068b049e3384bbd86c5d846e27e322c6c1427cf"},{"username":"genesisDelegate94","rank":167,"vote":"22390594052","publicKey":"084951fbaff0cdcb7652cff4c3fedbafddaa3a3a967d90c9047c3c561a035902"},{"username":"genesisDelegate46","rank":168,"vote":"22390594052","publicKey":"0dc75013ec1f596770c04c8d1e567f4f023edfdcde994a26b6b22752d59deca5"},{"username":"genesisDelegate36","rank":169,"vote":"22390594052","publicKey":"1c0dc3331faa3e9a6b4306dcbead78a474d2e3cb045db0a86ec7004512938e50"},{"username":"genesisDelegate35","rank":170,"vote":"22390594052","publicKey":"21fa24ebe0df1542776edfbcee171007f636e4dc2868823baf8ca2008bcc06c9"},{"username":"genesisDelegate39","rank":171,"vote":"22390594052","publicKey":"22528e02ce399df37cae931e6277da860c8e2c136bc2e143d3c6a2d8d256c048"},{"username":"genesisDelegate40","rank":163,"vote":"22390594052","publicKey":"047e1d4d9c03fa2a6ffc9cb386232f13bfa5aafb71989f3356393357657910ef"},{"username":"genesisDelegate90","rank":173,"vote":"20859405934","publicKey":"24536d386e742c36db3c9891869ab9c231e00b14fdb3da13df8605cfb7f1ff73"},{"username":"genesisDelegate83","rank":172,"vote":"20859405934","publicKey":"23c84e7fb8991bdd5cb4c3534278a133f9f46d6791135fb7975267bfd4327195"},{"username":"shadowserver","rank":174,"vote":"19117549761","publicKey":"855f46da84ca253c14a2c1627babde8b9895e99466b554f8888c60031d3d2301"},{"username":"genesisDelegate31","rank":176,"vote":"19098019796","publicKey":"28e705f027e6cec9a54329a8d5dd511b6bfd827f1c0a36b1594111eba9d7ed31"},{"username":"genesisDelegate38","rank":175,"vote":"19098019796","publicKey":"2814885e8a4140e3fd221e9034a8e4bcca95abc778d15f4d563976d703e1b8f6"},{"username":"cryptosukrit","rank":177,"vote":"17410000000","publicKey":"543b71355e51ddca6373b7301c8cc62fdc1766d2065667921d2ac430624bd623"},{"username":"belchiornet","rank":178,"vote":"17390000000","publicKey":"79c0aa9706149b12bb8a7cd2d809d371292ec65afbf017e0316d0fd74374c35b"},{"username":"hydrastakepool","rank":179,"vote":"16890000000","publicKey":"f72168a72c8ab31b83f3c1522e3c13fbe21544274488f027d11a8011861d6419"},{"username":"genesisDelegate27","rank":188,"vote":"15935544550","publicKey":"4f6d077b8d7a697f2f121bea9ea9fc1dbccd99641fe966a1272fa14762d47587"},{"username":"genesisDelegate95","rank":185,"vote":"15935544550","publicKey":"4a3881908bf4877ebc1ca0adb35a26a9e03b2246051bb245b9814818b1f15c7a"},{"username":"genesisDelegate89","rank":186,"vote":"15935544550","publicKey":"4be5c6c8ca097c869e3651b3efe31800219ad77fc8a3ff1ad56dd4c968e2a60a"},{"username":"genesisDelegate45","rank":187,"vote":"15935544550","publicKey":"4eb5be1481577c4711a30fccba01c61040caa85d8e5b0cde30306475cfaf4dc7"},{"username":"genesisDelegate50","rank":183,"vote":"15935544550","publicKey":"3214a2a26fd85d65c74d205fb7e231ded4febe9f37623dfbeb7beed76bcb0f50"},{"username":"genesisDelegate78","rank":189,"vote":"15935544550","publicKey":"5a02b752e4659a68635314772b4296a451304a017de6004c85ca50c6ab13d87d"},{"username":"genesisDelegate84","rank":181,"vote":"15935544550","publicKey":"2ff9a5044a42db9e211c2fd11f023a2d6357ae3370dc56f8bb1add9a1ddcd59c"},{"username":"genesisDelegate88","rank":184,"vote":"15935544550","publicKey":"42b9c26b60a3288eb308f700b173ccd68d3bc12f29f6fa7415407e1e50db6cc9"},{"username":"genesisDelegate43","rank":182,"vote":"15935544550","publicKey":"3180049ef78fa7bcbb27c31d33e7ca14d973ffbedea54b94d8644343fefa8b00"},{"username":"genesisDelegate21","rank":180,"vote":"15935544550","publicKey":"2e9c4c058fa3d707c41e727c42e98e6356ee5487b5b00e217e2aac00c507bbed"},{"username":"cct_joe","rank":190,"vote":"15495049709","publicKey":"bdf1b92eec8bf9143a5b49c43bed3fb31c479454db2db6223315727fff0a38d1"},{"username":"genesisDelegate29","rank":194,"vote":"14342871283","publicKey":"9309bae1dfb9bbb5c95bc256023471830b80c9fbbdd9add786748e53ac872c5f"},{"username":"genesisDelegate81","rank":195,"vote":"14342871283","publicKey":"95286ec6172a0ffaa895ff88041a4fd54a6d85674bbef4e6c388e201a8ee4f68"},{"username":"genesisDelegate96","rank":196,"vote":"14342871283","publicKey":"9fa2d9937628cbdbe0d3429c35c70545546ecc1972c2c7b78f81f7ce77de8ae3"},{"username":"genesisDelegate86","rank":197,"vote":"14342871283","publicKey":"ae91c786e54744614f159ac9a38f2ad2042e8eccb0de1eba35bfea85542a8c55"},{"username":"genesisDelegate30","rank":198,"vote":"14342871283","publicKey":"b3b373f4c42202e78799568b7fa48fccab34820020c35f5d1f0bd8fbc4ac22f1"},{"username":"genesisDelegate93","rank":199,"vote":"14342871283","publicKey":"bc19366d4308306d0975806ad7445c96e5543d022c39ade3c5c8c73af7a3bcda"},{"username":"genesisDelegate82","rank":200,"vote":"14342871283","publicKey":"c109e66e7f2481d7c941fc6b523cc9e1e46c7e161eb03a8999656709dc7e2c72"},{"username":"genesisDelegate33","rank":192,"vote":"14342871283","publicKey":"7989237bea3bfa919fd29b15a5dd363019c7c47f5ac95f6722ff06635cbad366"},{"username":"genesisDelegate32","rank":191,"vote":"14342871283","publicKey":"5a1e925732b6920b677293b607221aa5ccb5d7fe5af1e288e874bc45a2f49646"},{"username":"genesisDelegate92","rank":193,"vote":"14342871283","publicKey":"8757b58cf78a366e249328b90e58a761990f93eddb3f79f2d2b9890e749cbec3"},{"username":"risedevpool","rank":201,"vote":"13902974854","publicKey":"26d77434e1ef572dc8607d171a877296170b2c53845cd6151b03645197c24f5c"},{"username":"genesisDelegate23","rank":204,"vote":"12559108907","publicKey":"ccbfc68b597de2843e712b4763ae5ac4e86a376ce6eab9c493f057cb2755f386"}]
    //     //     .map((d) => ({...d, vote: parseInt(d.vote, 10), publicKey: Buffer.from(d.publicKey, 'hex')}));
    //     //   getKeysSortByVoteStub.resolves(delegates);
    //     //
    //     //   this.timeout(10000000);
    //     //   sha256Spy.restore();
    //     //   slotsStub.delegates   = 101;
    //     //   const numRounds       = 400000;
    //     //   let includedDelegates = 0;
    //     //   const delegatesMap    = {};
    //     //   delegates.forEach((d) => {
    //     //     const idx         = d.publicKey.toString('hex');
    //     //     delegatesMap[idx] = d;
    //     //   });
    //     //   for (let round = 0; round < numRounds; round++) {
    //     //     if (round % 1000 === 0) {
    //     //       console.log(`${round} rounds done`);
    //     //     }
    //     //     const list = await instance.generateDelegateList(round * 101);
    //     //     list.forEach((delegate) => {
    //     //       const idx               = delegate.toString('hex');
    //     //       delegatesMap[idx].count = typeof delegatesMap[idx].count !== 'undefined' ? delegatesMap[idx].count + 1 : 1;
    //     //     });
    //     //     roundsLogicStub.stubs.calcRound.resetHistory();
    //     //     getKeysSortByVoteStub.resetHistory();
    //     //   }
    //     //   const toSort = [];
    //     //   Object.keys(delegatesMap).forEach((k) => {
    //     //     const d     = delegatesMap[k];
    //     //     d.stringKey = d.publicKey.toString('hex');
    //     //     toSort.push(d);
    //     //   });
    //     //   toSort.sort((a, b) => {
    //     //     return b.vote - a.vote;
    //     //   });
    //     //   toSort.forEach((d, idx) => {
    //     //     const count   = d.count ? d.count : 0;
    //     //     const percent = ((count * 100) / numRounds).toFixed(2);
    //     //     console.log(`#${idx} username: ${d.username} vote: ${d.vote} inclusions: ${count} ${percent}%`);
    //     //     if (count > 0) {
    //     //       includedDelegates++;
    //     //     }
    //     //   });
    //     // });
    //
    //     it('should include at least once most delegates with vote > 0 in pool, in a long streak of rounds', async function () {
    //       this.timeout(100000);
    //       sha256Spy.restore();
    //       slotsStub.delegates   = 101;
    //       // 1 year...
    //       const numRounds       = 10407;
    //       let includedDelegates = 0;
    //       const delegatesMap    = {};
    //       delegates.forEach((d) => {
    //         const idx         = d.publicKey.toString('hex');
    //         delegatesMap[idx] = d;
    //       });
    //
    //       for (let round = 0; round < numRounds; round++) {
    //         if (round % 1000 === 0) {
    //           console.log(`${round} rounds done`);
    //         }
    //         const list = await instance.generateDelegateList(round * 101);
    //         list.forEach((delegate) => {
    //           const idx               = delegate.toString('hex');
    //           delegatesMap[idx].count = typeof delegatesMap[idx].count !== 'undefined' ? delegatesMap[idx].count + 1 : 1;
    //         });
    //         roundsLogicStub.stubs.calcRound.resetHistory();
    //         getKeysSortByVoteStub.resetHistory();
    //       }
    //       const toSort = [];
    //       Object.keys(delegatesMap).forEach((k) => {
    //         const d     = delegatesMap[k];
    //         d.stringKey = d.publicKey.toString('hex');
    //         toSort.push(d);
    //       });
    //       toSort.sort((a, b) => {
    //         return b.vote - a.vote;
    //       });
    //       toSort.forEach((d, idx) => {
    //         const count   = d.count ? d.count : 0;
    //         const percent = ((count * 100) / numRounds).toFixed(2);
    //         console.log(`#${idx} vote: ${d.vote} inclusions: ${count} ${percent}%`);
    //         if (count > 0) {
    //           includedDelegates++;
    //         }
    //       });
    //       // Only one delegate has zero vote, so it should never be included in round
    //       expect(includedDelegates).to.be.eq(delegates.length - 1);
    //     });
    //
    //     it('should include the top 101 delegates at least once in a short streak of rounds', async () => {
    //       slotsStub.delegates  = 101;
    //       // 1 day
    //       const numRounds      = 28;
    //       const inclusionCount = {};
    //       for (let round = 0; round < numRounds; round++) {
    //         const list = await instance.generateDelegateList(round * 101);
    //         list.forEach((delegate) => {
    //           const idx           = delegate.toString('hex');
    //           inclusionCount[idx] = typeof inclusionCount[idx] !== 'undefined' ? inclusionCount[idx] + 1 : 1;
    //         });
    //       }
    //       for (let i = 0; i < 101; i++) {
    //         const idx = delegates[i].publicKey.toString('hex');
    //         expect(inclusionCount[idx]).not.to.be.undefined;
    //         expect(inclusionCount[idx]).to.be.gt(0);
    //       }
    //     });
    //
    //     it('should sort delegates by public Key if resulting weight is the same', async () => {
    //       const oldRandom                  = MersenneTwister.prototype.random;
    //       // We need to make sure to get the same weight for all delegates. (same vote, same random factor)
    //       MersenneTwister.prototype.random = () => {
    //         return 0.999;
    //       };
    //       for (let i = 0; i < delegates.length; i++) {
    //         const k = new Buffer(1);
    //         k.writeUInt8(i, 0);
    //         delegates[i] = {
    //           publicKey: k,
    //           vote     : 1000000000,
    //         };
    //       }
    //       const list       = await instance.generateDelegateList(32 * 101);
    //       const stringList = list.map((k) => k.toString('hex'));
    //       const excluded   = delegates.length - slotsStub.delegates;
    //       // Delegates with low-value publicKey are excluded
    //       for (let i = 0; i < excluded; i++) {
    //         const pk = new Buffer(1);
    //         pk.writeUInt8(i, 0);
    //         expect(stringList.indexOf(pk.toString('hex'))).to.be.equal(-1);
    //       }
    //       // Delegates with high-value publicKey are included
    //       for (let i = excluded; i < delegates.length; i++) {
    //         const pk = new Buffer(1);
    //         pk.writeUInt8(i, 0);
    //         expect(stringList.indexOf(pk.toString('hex'))).to.be.gte(0);
    //       }
    //       MersenneTwister.prototype.random = oldRandom;
    //     });
    //   });
  });

  describe('getDelegates', () => {
    let getAccountsStub: SinonStub;
    beforeEach(() => {
      getAccountsStub = sandbox
        .stub(accountsModule, 'getAccounts')
        .resolves(testAccounts);
    });

    it('should throw if !query', async () => {
      await expect(instance.getDelegates(undefined)).to.be.rejectedWith(
        'Missing query argument'
      );
    });

    it('should call accountsModule.getAccounts', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(getAccountsStub.calledOnce).to.be.true;
      expect(getAccountsStub.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        sort: { vote: -1, publicKey: 1 },
      });
    });

    it('should call blockReward.calcSupply', async () => {
      await instance.getDelegates({ orderBy: 'votes' });
      expect(calcSupplyStub.calledOnce).to.be.true;
      expect(calcSupplyStub.firstCall.args[0]).to.be.equal(
        blocksModule.lastBlock.height
      );
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
      const retVal = await instance.getDelegates({
        limit: 50,
        offset: 40,
        orderBy: 'votes',
      });
      expect(retVal.count).to.be.equal(testAccounts.length);
      expect(Array.isArray(retVal.delegates)).to.be.true;
      retVal.delegates.forEach((delegate, key) => {
        expect(delegate.info.rank).to.be.equal(key + 1);
        expect(delegate.info.approval).to.be.equal(
          Math.floor(
            (parseInt(`${delegate.delegate.vote}`, 10) /
              parseInt(`${totalSupply}`, 10)) *
              1e4
          ) / 1e2
        );
        const percent =
          Math.abs(
            100 -
              delegate.delegate.missedblocks /
                ((delegate.delegate.producedblocks +
                  delegate.delegate.missedblocks) /
                  100)
          ) || 0;
        expect(delegate.info.productivity).to.be.equal(
          Math.round(percent * 1e2) / 1e2
        );
      });
      expect(retVal.limit).to.be.equal(90);
      expect(retVal.offset).to.be.equal(40);
      expect(retVal.sortField).to.be.equal('votes');
      expect(retVal.sortMethod).to.be.null;
    });

    it('should limit correctly when limit passed', async () => {
      const retVal = await instance.getDelegates({
        limit: 50,
        orderBy: 'votes',
      });
      expect(retVal.limit).to.be.equal(50);
    });

    it('should limit correctly when offset passed', async () => {
      const retVal = await instance.getDelegates({
        limit: 50,
        offset: 50,
        orderBy: 'votes',
      });
      expect(retVal.limit).to.be.equal(100);
    });
  });

  describe('assertValidBlockSlot', () => {
    let keys: Array<{ publicKey: string; vote: number }>;
    let getKeysSortByVoteStub: SinonStub;
    let generateDelegateListStub: SinonStub;
    const curSlot = 33;

    beforeEach(() => {
      // Copy the original accounts so we can safely manipulate them
      const delegates = testAccounts.slice();
      // Create an array of publicKeys
      keys = [];
      delegates.forEach((el) => {
        keys.push({ publicKey: el.publicKey, vote: 1 });
      });
      getKeysSortByVoteStub = sandbox.stub(
        instance as any,
        'getFilteredDelegatesSortedByVote'
      );
      getKeysSortByVoteStub.resolves(keys);
      // roundsLogic.stubs.calcRound.returns(123);
      generateDelegateListStub = sandbox
        .stub(instance, 'generateDelegateList')
        .resolves(keys.map((k) => Buffer.from(k.publicKey, 'hex')));
      // slots.stubs.getSlotNumber.returns(curSlot);
      signedBlock.generatorPublicKey = Buffer.from(
        keys[curSlot % 101].publicKey,
        'hex'
      );
    });

    it('should call generateDelegateList', async () => {
      await instance.assertValidBlockSlot(signedBlock);
      expect(generateDelegateListStub.calledOnce).to.be.true;
      expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(
        signedBlock.height
      );
    });

    it('should validate slot getSlotNumber', async () => {
      await instance.assertValidBlockSlot(signedBlock);
    });

    it('should throw error if generator is different', async () => {
      await expect(
        instance.assertValidBlockSlot({
          ...signedBlock,
          timestamp: signedBlock.timestamp + constants.blocks.targetTime,
        })
      ).rejectedWith('Failed to verify slot 34');
    });
  });
  // TODO: Matteo
  // describe('getFilteredDelegatesSortedByVote', () => {
  //   beforeEach(() => {
  //     accountsModuleStub.stubs.getAccounts.resolves(testAccounts);
  //   });
  //   it('should call accountsModule.getAccounts with proper filter', async () => {
  //     (instance as any).constants.dposv2.firstBlock = 1000;
  //
  //     // Still v1
  //     await (instance as any).getFilteredDelegatesSortedByVote(999);
  //     expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
  //     expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
  //       isDelegate: 1,
  //       limit     : 101,
  //       sort      : { vote: -1, publicKey: 1 },
  //     });
  //     accountsModuleStub.stubs.getAccounts.resetHistory();
  //
  //     // on v2
  //     await (instance as any).getFilteredDelegatesSortedByVote(1000);
  //     expect(accountsModuleStub.stubs.getAccounts.calledOnce).to.be.true;
  //     expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
  //       isDelegate: 1,
  //       limit     : 101,
  //       cmb       : { [Op.lte]: (instance as any).constants.dposv2.maxContinuousMissedBlocks },
  //       publicKey : { },
  //       sort      : { votesWeight: -1, publicKey: 1 },
  //     });
  //     expect(accountsModuleStub.stubs.getAccounts.firstCall.args[1]).to.be.deep.equal(['publicKey', 'votesWeight']);
  //     expect(accountsModuleStub.stubs.getAccounts.firstCall.args[0].cmb[Op.lte]).eq((instance as any).constants.dposv2.maxContinuousMissedBlocks);
  //
  //   });
  //
  //   it('should return an array of publicKeys and votes', async () => {
  //     const retVal = await (instance as any).getFilteredDelegatesSortedByVote(1);
  //     expect(Array.isArray(retVal)).to.be.true;
  //     retVal.forEach((el, k) => {
  //       expect(el.vote).to.be.equal((testAccounts[k] as any).vote);
  //       expect(el.publicKey).to.be.equal(testAccounts[k].publicKey);
  //     });
  //   });
  // });

  describe('checkDelegates', () => {
    let theAccount: any;
    let getAccountStub: SinonStub;
    beforeEach(() => {
      theAccount = new accountsModel({ address: testAccounts[0].address });
      theAccount.publicKey = Buffer.from(testAccounts[0].publicKey, 'hex');
      theAccount.privKey = Buffer.from(testAccounts[0].privKey, 'hex');
      theAccount.delegates = [];
      theAccount.u_delegates = [];
      getAccountStub = sandbox.stub(accountsModule, 'getAccount').resolves({});
    });

    it('should throw if account not provided', async () => {
      await expect(
        (instance as any).checkDelegates(null, [], 'confirmed')
      ).to.be.rejectedWith('Account not found');
    });

    it('should throw if invalid math operator found in votes', async () => {
      await expect(
        (instance as any).checkDelegates(theAccount, ['*123'], 'confirmed')
      ).to.be.rejectedWith('Invalid math operator');
    });

    it('should throw if invalid public key in votes', async () => {
      votes.push('+meow');
      await expect(
        (instance as any).checkDelegates(theAccount, votes, 'confirmed')
      ).to.be.rejectedWith('Invalid public key');
    });

    it('should throw if trying to vote again for the same delegate', async () => {
      theAccount.delegates.push(votes[0].substr(1));
      await expect(
        (instance as any).checkDelegates(theAccount, votes, 'confirmed')
      ).to.be.rejectedWith(
        'Failed to add vote, account has already voted for this delegate'
      );
    });

    it('should throw if trying to remove vote for a non-voted delegate', async () => {
      const unvotes = votes.slice();
      unvotes[0] = unvotes[0].replace('+', '-');
      await expect(
        (instance as any).checkDelegates(theAccount, unvotes, 'confirmed')
      ).to.be.rejectedWith(
        'Failed to remove vote, account has not voted for this delegate'
      );
    });

    it('should call accountsModule.getAccount on vote publicKey', async () => {
      await (instance as any).checkDelegates(theAccount, votes, 'confirmed');
      expect(getAccountStub.callCount).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
        isDelegate: 1,
        publicKey: Buffer.from(votes[0].substr(1), 'hex'),
      });
    });

    it('should throw if delegate not found', async () => {
      getAccountStub.onFirstCall().resolves(null);
      await expect(
        (instance as any).checkDelegates(theAccount, votes, 'confirmed')
      ).to.be.rejectedWith('Delegate not found');
    });

    it('should throw if trying to vote or unvote too many delegates', async () => {
      getAccountStub.onSecondCall().resolves({});
      const wrongVotes = [
        '+' + testAccounts[0].publicKey,
        '+' + testAccounts[1].publicKey,
      ];
      await expect(
        (instance as any).checkDelegates(
          theAccount.publicKey,
          wrongVotes,
          'confirmed'
        )
      ).to.be.rejectedWith('Maximum number of 1 votes exceeded (1 too many)');
    });
  });
});
