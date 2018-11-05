import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { DelegatesAPI } from '../../../src/apis';
import {
  IAccountsModule,
  IBlocksModel,
  IBlocksModule,
  ICrypto,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { DelegatesModule, ForgeModule } from '../../../src/modules';
import { dPoSSymbols, Slots } from '../../../src/helpers';
import {
  Accounts2DelegatesModel,
  AccountsModelForDPOS,
} from '../../../src/models';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { APISymbols } from '@risevision/core-apis';
import { LiskWallet } from 'dpos-offline';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/delegatesAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: DelegatesAPI;
  let blocksModel: typeof IBlocksModel;
  let accounts: IAccountsModule;
  let blocks: IBlocksModule;
  let delegatesModule: DelegatesModule;
  let ed: ICrypto;
  let forgeModule: ForgeModule;
  let slots: Slots;
  let system: ISystemModule;
  let accountsModel: typeof AccountsModelForDPOS;
  let accounts2delegatesModel: typeof Accounts2DelegatesModel;
  before(async () => {
    container = await createContainer([
      'core-consensus-dpos',
      'core-helpers',
      'core-crypto',
      'core',
    ]);
  });
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    accounts = container.get(Symbols.modules.accounts);
    accountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    blocksModel = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    blocks = container.get(Symbols.modules.blocks);
    delegatesModule = container.get(dPoSSymbols.modules.delegates);
    ed = container.get(Symbols.generic.crypto);
    forgeModule = container.get(dPoSSymbols.modules.forge);
    slots = container.get(dPoSSymbols.helpers.slots);
    system = container.get(Symbols.modules.system);
    accounts2delegatesModel = container.getNamed(
      ModelSymbols.model,
      dPoSSymbols.models.accounts2Delegates
    );
    instance = container.getNamed(APISymbols.class, dPoSSymbols.delegatesAPI);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDelegates', () => {
    const extraAccountData = {
      approval: undefined,
      address: null,
      missedblocks: undefined,
      producedblocks: undefined,
      productivity: undefined,
      username: undefined,
      vote: '0',
    };
    let data;
    let d;
    let getDelegatesStub: SinonStub;

    // helper to set a returned object with delegates from elegatesModule.getDelegates method
    const setReturnedDelegates = (
      sortField,
      sortMethod,
      areNumberValues = true,
      limit = 3,
      offset = 0
    ) => {
      let field;
      if (sortField) {
        field = sortField;
      } else {
        field = 'f';
      }

      const delegates = [
        {
          delegate: new accountsModel({
            publicKey: Buffer.from('aa', 'hex'),
            [field]: areNumberValues ? 1 : 'a',
          }),
          info: { rank: 1, [field]: areNumberValues ? 1 : 'a' },
        },
        {
          delegate: new accountsModel({
            publicKey: Buffer.from('bb', 'hex'),
            [field]: areNumberValues ? 3 : 'bb',
          }),
          info: { rank: 2, [field]: areNumberValues ? 3 : 'bb' },
        },
        {
          delegate: new accountsModel({
            publicKey: Buffer.from('cc', 'hex'),
            [field]: areNumberValues ? 2 : 'ccc',
          }),
          info: { rank: 3, [field]: areNumberValues ? 2 : 'ccc' },
        },
      ];

      d = {
        count: delegates.length,
        delegates,
        limit,
        offset,
        sortField,
        sortMethod,
      };

      getDelegatesStub = sandbox
        .stub(delegatesModule, 'getDelegates')
        .resolves(d);
    };

    beforeEach(() => {
      data = {
        limit: '10',
        offset: '1',
        orderBy: 'rank:desc',
      };
    });

    it('should call delegatesModule.getDelegates', async () => {
      setReturnedDelegates('approval', 'ASC');
      await instance.getDelegates(data);

      expect(getDelegatesStub.calledOnce).to.be.true;
      expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
      expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal(data);
    });

    describe('sorting', () => {
      it('sortField === approval, sortMethod === ASC', async () => {
        setReturnedDelegates('approval', 'ASC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          {
            ...extraAccountData,
            approval: 1,
            rank: 1,
            rate: 1,
            publicKey: 'aa',
          },
          {
            ...extraAccountData,
            approval: 2,
            rank: 3,
            rate: 3,
            publicKey: 'cc',
          },
          {
            ...extraAccountData,
            approval: 3,
            rank: 2,
            rate: 2,
            publicKey: 'bb',
          },
        ]);
      });

      it('sortField === approval, sortMethod !== ASC', async () => {
        setReturnedDelegates('approval', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          {
            ...extraAccountData,
            approval: 3,
            rank: 2,
            rate: 2,
            publicKey: 'bb',
          },
          {
            ...extraAccountData,
            approval: 2,
            rank: 3,
            rate: 3,
            publicKey: 'cc',
          },
          {
            ...extraAccountData,
            approval: 1,
            rank: 1,
            rate: 1,
            publicKey: 'aa',
          },
        ]);
      });

      it('sortField === username, sortMethod === ASC', async () => {
        setReturnedDelegates('username', 'ASC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          {
            ...extraAccountData,
            username: 'a',
            rank: 1,
            rate: 1,
            publicKey: 'aa',
          },
          {
            ...extraAccountData,
            username: 'bb',
            rank: 2,
            rate: 2,
            publicKey: 'bb',
          },
          {
            ...extraAccountData,
            username: 'ccc',
            rank: 3,
            rate: 3,
            publicKey: 'cc',
          },
        ]);
      });

      it('sortField === username, sortMethod !== ASC', async () => {
        setReturnedDelegates('username', 'DESC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          {
            ...extraAccountData,
            username: 'ccc',
            rank: 3,
            rate: 3,
            publicKey: 'cc',
          },
          {
            ...extraAccountData,
            username: 'bb',
            rank: 2,
            rate: 2,
            publicKey: 'bb',
          },
          {
            ...extraAccountData,
            username: 'a',
            rank: 1,
            rate: 1,
            publicKey: 'aa',
          },
        ]);
      });

      it('sortField state is null', async () => {
        setReturnedDelegates(null, 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          { ...extraAccountData, rank: 1, rate: 1, publicKey: 'aa' },
          { ...extraAccountData, rank: 2, rate: 2, publicKey: 'bb' },
          { ...extraAccountData, rank: 3, rate: 3, publicKey: 'cc' },
        ]);
      });

      it('sortField state is not to same the allowed fields', async () => {
        setReturnedDelegates('NICKBORSUK', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          { ...extraAccountData, rank: 1, rate: 1, publicKey: 'aa' },
          { ...extraAccountData, rank: 2, rate: 2, publicKey: 'bb' },
          { ...extraAccountData, rank: 3, rate: 3, publicKey: 'cc' },
        ]);
      });
    });

    it('check slice array by offset', async () => {
      setReturnedDelegates('approval', 'ASC', true, undefined, 2);
      const ret = await instance.getDelegates(data);

      expect(
        ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
      ).to.be.deep.equal([{ approval: 3, rank: 2, rate: 2 }]);
    });

    it('check slice array by limit', async () => {
      setReturnedDelegates('approval', 'ASC', true, 1);
      const ret = await instance.getDelegates(data);

      expect(
        ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
      ).to.be.deep.equal([{ approval: 1, rank: 1, rate: 1 }]);
    });

    it('should return an object with a delegates array and a totalCount', async () => {
      setReturnedDelegates('approval', 'ASC');
      const ret = await instance.getDelegates(data);

      expect(
        ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
      ).to.be.deep.equal([
        { approval: 1, rank: 1, rate: 1 },
        { approval: 2, rank: 3, rate: 3 },
        { approval: 3, rank: 2, rate: 2 },
      ]);
      expect(ret.totalCount).to.be.deep.eq(3);
    });
  });

  describe('getFee', () => {
    let params;
    let f;
    let getFeesStub: SinonStub;
    beforeEach(() => {
      params = { height: 1 };
      f = { fees: { delegate: 'delegate' }, otherField: 'KNOCK' };

      getFeesStub = sandbox.stub(system, 'getFees').returns(f);
    });

    it('should call system.getFees', async () => {
      await instance.getFee(params);

      expect(getFeesStub.calledOnce).to.be.true;
      expect(getFeesStub.firstCall.args.length).to.be.equal(1);
      expect(getFeesStub.firstCall.args[0]).to.be.equal(1);
    });

    it('should delete field fees from f', async () => {
      await instance.getFee(params);

      expect(f).to.not.have.property('fees');
    });

    it('should return an object with the properties fee and otherField', async () => {
      const ret = await instance.getFee(params);

      expect(ret).to.be.deep.equal({
        fee: 'delegate',
        otherField: 'KNOCK',
      });
    });
  });

  // describe('getForgedByAccount', () => {
  //
  //   let params;
  //
  //   describe('if params.start or params.end isn"t undefined', () => {
  //
  //     let reward;
  //
  //     beforeEach(() => {
  //       reward = {
  //         count  : 1,
  //         fees   : 5,
  //         rewards: 5,
  //       };
  //       params = {
  //         end               : 10,
  //         generatorPublicKey: 'generatorPublicKey',
  //         start             : 0,
  //       };
  //       blocksUtils.enqueueResponse('aggregateBlockReward', Promise.resolve(reward));
  //     });
  //
  //     it('only params.start is not undefined', async () => {
  //       delete params.end;
  //       await instance.getForgedByAccount(params);
  //
  //       expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
  //     });
  //
  //     it('only params.end is not undefined', async () => {
  //       delete params.start;
  //       await instance.getForgedByAccount(params);
  //
  //       expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
  //     });
  //
  //     it('should call this.blocksUtils.aggregateBlockReward', async () => {
  //       await instance.getForgedByAccount(params);
  //
  //       expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
  //       expect(blocksUtils.stubs.aggregateBlockReward.firstCall.args.length).to.be.equal(1);
  //       expect(blocksUtils.stubs.aggregateBlockReward.firstCall.args[0]).to.be.deep.equal({ ...params });
  //     });
  //
  //     it('should return an object with the properties: count, fees, rewards and forged', async () => {
  //       const ret = await instance.getForgedByAccount(params);
  //
  //       expect(ret).to.be.deep.equal({
  //         ...reward,
  //         forged: '10',
  //       });
  //     });
  //
  //   });
  //
  //   describe('if params.start and params.end are undefined', () => {
  //
  //     let account;
  //
  //     beforeEach(() => {
  //       account = {
  //         fees   : 5,
  //         rewards: 5,
  //       };
  //       params  = {
  //         generatorPublicKey: 'generatorPublicKey',
  //       };
  //       accounts.enqueueResponse('getAccount', Promise.resolve(account));
  //     });
  //
  //     it('should call this.blocksUtils.aggregateBlockReward', async () => {
  //       await instance.getForgedByAccount(params);
  //
  //       expect(accounts.stubs.getAccount.calledOnce).to.be.true;
  //       expect(accounts.stubs.getAccount.firstCall.args.length).to.be.equal(2);
  //       expect(accounts.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: Buffer.from(params.generatorPublicKey, 'hex') });
  //       expect(accounts.stubs.getAccount.firstCall.args[1]).to.be.deep.equal(['fees', 'rewards']);
  //     });
  //
  //     it('thould throw error if account not found', async () => {
  //       accounts.reset();
  //       accounts.enqueueResponse('getAccount', Promise.resolve(null));
  //
  //       await expect(instance.getForgedByAccount(params)).to.be.rejectedWith('Account not found');
  //     });
  //
  //     it('should return an object with the properties: fees, forged and rewards', async () => {
  //       const ret = await instance.getForgedByAccount(params);
  //
  //       expect(ret).to.be.deep.equal(
  //         {
  //           fees   : 5,
  //           forged : '10',
  //           rewards: 5,
  //         });
  //     });
  //
  //   });
  // });

  describe('getDelegate', () => {
    let params;
    let delegates;
    let getDelegatesStub: SinonStub;
    beforeEach(() => {
      params = {
        publicKey: new LiskWallet('meow', 'R').publicKey,
        username: 'username',
      };
      delegates = [
        {
          delegate: new accountsModel({
            publicKey: Buffer.from('aaaa', 'hex'),
            username: 'username',
          }),
          info: {
            rank: 1,
            approval: 1,
            productivity: 100,
          },
        },
        {
          delegate: new accountsModel({
            publicKey: Buffer.from('1111', 'hex'),
            username: '222',
          }),
          info: {
            rank: 2,
            approval: 1,
            productivity: 100,
          },
        },
      ];
      getDelegatesStub = sandbox
        .stub(delegatesModule, 'getDelegates')
        .resolves({ delegates });
    });

    it('should call delegatesModule.getDelegates', async () => {
      await instance.getDelegate(params);
      expect(getDelegatesStub.calledOnce).to.be.true;
      expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
      expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal({
        orderBy: 'username:asc',
      });
    });

    it('should return an object with the property: delegate', async () => {
      const ret = await instance.getDelegate(params);
      const expected = {
        delegate: {
          ...delegates[0].delegate.toPOJO(),
          ...delegates[0].info,
          rate: delegates[0].info.rank,
        },
      };
      delete expected.delegate.secondPublicKey;
      expect(ret).to.be.deep.equal(expected);
    });

    it('should throw error if no delegate matches found', async () => {
      getDelegatesStub.resolves({ delegates: [] });

      await expect(instance.getDelegate(params)).to.be.rejectedWith(
        'Delegate not found'
      );
    });
  });

  describe('getVoters', () => {
    let params;
    let row;
    let accountsObject;
    let findAll: SinonStub;
    let getAccountsStub;
    beforeEach(() => {
      row = { accountIds: [{}] };
      accountsObject = {};
      params = { publicKey: new LiskWallet('meow', 'R').publicKey };
      findAll = sandbox.stub(accounts2delegatesModel, 'findAll').resolves([]);
      getAccountsStub = sandbox.stub(accounts, 'getAccounts').resolves([]);
    });

    it('should correctly query Accounts2DelegatesModel', async () => {
      await instance.getVoters({
        publicKey: new LiskWallet('meow', 'R').publicKey,
      });
      expect(findAll.firstCall.args[0]).to.be.deep.eq({
        attributes: ['accountId'],
        where: { dependentId: new LiskWallet('meow', 'R').publicKey },
      });
    });
    it('should correctly query accountsModule.getAccounts', async () => {
      findAll.resolves([{ accountId: '1' }, { accountId: '2' }]);
      getAccountsStub.resolves([new accountsModel(), new accountsModel()]);
      await instance.getVoters({
        publicKey: new LiskWallet('meow', 'R').publicKey,
      });
      expect(getAccountsStub.firstCall.args[0]).to.be.deep.eq({
        sort: 'balance',
        address: { $in: ['1', '2'] },
      });
    });

    it('should return subset of accounts infos', async () => {
      getAccountsStub.resolves([
        new accountsModel({
          address: '1',
          publicKey: Buffer.from('aa', 'hex'),
        }),
        new accountsModel({
          address: '2',
          publicKey: Buffer.from('bb', 'hex'),
        }),
      ]);
      const res = await instance.getVoters(params);
      expect(res).to.be.deep.eq({
        accounts: [
          { address: '1', publicKey: 'aa' },
          { address: '2', publicKey: 'bb' },
        ],
      });
    });
  });

  describe('search', () => {
    let params;
    let orderBy;
    let query: SinonStub;

    beforeEach(() => {
      orderBy = {
        sortField: 'sortField',
        sortMethod: 'sortMethod',
      };
      params = {
        limit: 5,
        orderBy: 'username',
        q: 'query',
      };

      query = sandbox.stub(accountsModel.sequelize, 'query').resolves([]);
    });
    it('should query by name', async () => {
      await instance.search({ q: 'vek' });
      expect(query.firstCall.args[0]).to.be.deep.eq(`
    WITH
      supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
      delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
        m.username,
        m.address,
        ENCODE(m."publicKey", 'hex') AS "publicKey",
        m.vote,
        m.producedblocks,
        m.missedblocks,
        ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval,
        (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE
        ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2)
        END)::float AS productivity,
        COALESCE(v.voters_cnt, 0) AS voters_cnt,
        t.timestamp AS register_timestamp
        FROM delegates d
        LEFT JOIN mem_accounts m ON d.username = m.username
        LEFT JOIN trs t ON d."transactionId" = t.id
        LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", 'hex')
        WHERE m."isDelegate" = 1
        ORDER BY "username" ASC)
      SELECT * FROM delegates WHERE username LIKE '%vek%' LIMIT 101
    `);
    });
    it('should honorate also limit and orderBy with a SQL injection test', async () => {
      await instance.search({
        q: "1' or '1=1",
        orderBy: 'username:desc',
        limit: 10,
      });
      expect(query.firstCall.args[0]).to.be.deep.eq(`
    WITH
      supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
      delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
        m.username,
        m.address,
        ENCODE(m."publicKey", 'hex') AS "publicKey",
        m.vote,
        m.producedblocks,
        m.missedblocks,
        ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval,
        (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE
        ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2)
        END)::float AS productivity,
        COALESCE(v.voters_cnt, 0) AS voters_cnt,
        t.timestamp AS register_timestamp
        FROM delegates d
        LEFT JOIN mem_accounts m ON d.username = m.username
        LEFT JOIN trs t ON d."transactionId" = t.id
        LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", 'hex')
        WHERE m."isDelegate" = 1
        ORDER BY "username" desc)
      SELECT * FROM delegates WHERE username LIKE '%1'' or ''1=1%' LIMIT 10
    `);
    });
  });

  describe('count', () => {
    it('should call model.count', async () => {
      const stub = sandbox.stub(accounts2delegatesModel, 'count').resolves(1);
      const res = await instance.count();
      expect(res).to.be.deep.eq({ count: 1 });
      expect(stub.called).is.true;
    });
  });

  describe('getNextForgers', () => {
    let limit;
    let activeDelegates;
    let currentSlot;
    let currentBlockSlot;
    let getSlotNumberStub: SinonStub;
    let generateDelegateListStub: SinonStub;

    beforeEach(() => {
      limit = 3;
      activeDelegates = [
        Buffer.from('aa', 'hex'),
        Buffer.from('bb', 'hex'),
        Buffer.from('cc', 'hex'),
      ];
      currentSlot = 1;
      currentBlockSlot = 1;
      (blocks as any).lastBlock = new blocksModel({
        height: 5,
        timestamp: 2,
        generatorPublicKey: new Buffer('aa'),
        payloadHash: new Buffer('aa'),
        blockSignature: new Buffer('aa'),
      });

      generateDelegateListStub = sandbox
        .stub(delegatesModule, 'generateDelegateList')
        .resolves(activeDelegates);
      getSlotNumberStub = sandbox
        .stub(slots, 'getSlotNumber')
        .onFirstCall()
        .returns(currentSlot);
      getSlotNumberStub.onSecondCall().returns(currentBlockSlot);
    });

    it('should call delegatesModule.generateDelegateList', async () => {
      await instance.getNextForgers(limit);

      expect(generateDelegateListStub.calledOnce).to.be.true;
      expect(generateDelegateListStub.firstCall.args.length).to.be.equal(1);
      expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(
        blocks.lastBlock.height
      );
    });

    it('should call slots.getSlotNumber twice', async () => {
      await instance.getNextForgers(limit);

      expect(getSlotNumberStub.calledTwice).to.be.true;

      expect(getSlotNumberStub.firstCall.args.length).to.be.equal(1);
      expect(getSlotNumberStub.firstCall.args[0]).to.be.equal(
        blocks.lastBlock.timestamp
      );

      expect(getSlotNumberStub.secondCall.args.length).to.be.equal(0);
    });

    it('should return an object with the properties: currentBlock, currentBlockSlot, currentSlot and delegates', async () => {
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
        currentBlockSlot: 1,
        currentSlot: 1,
        delegates: ['cc'],
      });
    });

    it('should return empty delegates array if limit = 0', async () => {
      limit = 0;
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
        currentBlockSlot: 1,
        currentSlot: 1,
        delegates: [],
      });
    });

    it('should return empty delegates array if slots.delegates < 1', async () => {
      Object.defineProperty(slots, 'delegates', { value: 0 });
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
        currentBlockSlot: 1,
        currentSlot: 1,
        delegates: [],
      });
    });
  });

  describe('createDelegate', () => {
    it('should return a rejected promise', async () => {
      await expect(instance.createDelegate()).to.be.rejectedWith(
        'Method is deprecated'
      );
    });
  });

  describe('getForgingStatus', () => {
    let params;
    let enabled;
    let delegates;
    let isForgeEnabledOnStub: SinonStub;
    let getEnabledKeysStub: SinonStub;

    beforeEach(() => {
      params = { publicKey: new LiskWallet('meow', 'R').publicKey };
      enabled = true;
      delegates = [{}, {}];

      isForgeEnabledOnStub = sandbox
        .stub(forgeModule, 'isForgeEnabledOn')
        .returns(enabled);
      getEnabledKeysStub = sandbox
        .stub(forgeModule, 'getEnabledKeys')
        .returns(delegates);
    });

    it('param.publicKey', async () => {
      const ret = await instance.getForgingStatus(params);

      expect(ret).to.be.deep.equal({
        delegates: [params.publicKey],
        enabled: true,
      });

      expect(isForgeEnabledOnStub.calledOnce).to.be.true;
      expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
      expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.equal(
        params.publicKey
      );
    });

    it('!param.publicKey', async () => {
      delete params.publicKey;
      const ret = await instance.getForgingStatus(params);

      expect(getEnabledKeysStub.calledOnce).to.be.true;
      expect(getEnabledKeysStub.firstCall.args.length).to.be.equal(0);

      expect(ret).to.be.deep.equal({ delegates, enabled: true });
    });
  });

  describe('forgingEnable', () => {
    let params;
    let kp;
    let publicKey;
    let account;
    let hash;
    let isForgeEnabledOnStub: SinonStub;
    let getAccountStub: SinonStub;
    let enableForgeStub: SinonStub;

    beforeEach(() => {
      account = { isDelegate: true };
      publicKey = new LiskWallet('meow', 'R').publicKey;
      params = {
        publicKey,
        secret: 'meow',
      };
      kp = { publicKey };
      isForgeEnabledOnStub = sandbox
        .stub(forgeModule, 'isForgeEnabledOn')
        .returns(false);
      enableForgeStub = sandbox.stub(forgeModule, 'enableForge').returns({});
      getAccountStub = sandbox.stub(accounts, 'getAccount').returns(account);

      // ed.enqueueResponse('makeKeypair', kp);
    });

    // it('should call ed.makeKeypair', async () => {
    //   await instance.forgingEnable(params);
    //
    //   expect(ed.stubs.makeKeypair.calledOnce).to.be.true;
    //   expect(ed.stubs.makeKeypair.firstCall.args.length).to.be.equal(1);
    //   expect(ed.stubs.makeKeypair.firstCall.args[0]).to.be.deep.equal(hash);
    // });

    // it('should call crypto.createHash', async () => {
    //   await instance.forgingEnable(params);
    //
    //   // the first call in beforeEach hook
    //   expect(cryptoCreateHashSpy.calledTwice).to.be.true;
    //   expect(cryptoCreateHashSpy.secondCall.args.length).to.be.equal(1);
    //   expect(cryptoCreateHashSpy.secondCall.args[0]).to.be.equal('sha256');
    // });

    it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
      sandbox.stub(ed, 'makeKeyPair').returns({ publicKey: 'sss' });

      await expect(instance.forgingEnable(params)).to.be.rejectedWith(
        'Invalid passphrase'
      );
    });

    it('should call forgeModule.isForgeEnabledOn', async () => {
      await instance.forgingEnable(params);

      expect(isForgeEnabledOnStub.calledOnce).to.be.true;
      expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
      expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.deep.equal(
        publicKey
      );
    });

    it('should throw error if forgeModule.isForgeEnabledOn returns true', async () => {
      isForgeEnabledOnStub.returns(true);

      await expect(instance.forgingEnable(params)).to.be.rejectedWith(
        'Forging is already enabled'
      );
    });

    it('should call accounts.getAccount', async () => {
      await instance.forgingEnable(params);

      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args.length).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
        publicKey: Buffer.from(publicKey, 'hex'),
      });
    });

    it('should throw error if account not found', async () => {
      getAccountStub.returns(false);

      await expect(instance.forgingEnable(params)).to.be.rejectedWith(
        'Account not found'
      );
    });

    it('should throw error if delegate not found', async () => {
      getAccountStub.returns({});

      await expect(instance.forgingEnable(params)).to.be.rejectedWith(
        'Delegate not found'
      );
    });

    it('should call forgeModule.enableForge', async () => {
      await instance.forgingEnable(params);

      expect(enableForgeStub.calledOnce).to.be.true;
      expect(enableForgeStub.firstCall.args.length).to.be.equal(1);
      expect(enableForgeStub.firstCall.args[0]).to.be.deep.equal({
        publicKey: Buffer.from(publicKey, 'hex'),
        privateKey: Buffer.from(
          new LiskWallet(params.secret, 'R').privKey,
          'hex'
        ),
      });
    });
  });

  describe('forgingDisable', () => {
    let params;
    let kp;
    let publicKey;
    let account;
    let isForgeEnabledOnStub: SinonStub;
    let disableForgeStub: SinonStub;
    let getAccountStub: SinonStub;

    beforeEach(() => {
      account = { isDelegate: true };
      publicKey = new LiskWallet('meow', 'R').publicKey;
      params = {
        publicKey,
        secret: 'meow',
      };
      kp = { publicKey };
      isForgeEnabledOnStub = sandbox
        .stub(forgeModule, 'isForgeEnabledOn')
        .returns(true);
      disableForgeStub = sandbox.stub(forgeModule, 'disableForge').returns({});
      getAccountStub = sandbox.stub(accounts, 'getAccount').returns(account);
    });

    it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
      sandbox.stub(ed, 'makeKeyPair').returns({ publicKey: 'sss' });
      await expect(instance.forgingDisable(params)).to.be.rejectedWith(
        'Invalid passphrase'
      );
    });

    it('should call forgeModule.isForgeEnabledOn', async () => {
      await instance.forgingDisable(params);

      expect(isForgeEnabledOnStub.calledOnce).to.be.true;
      expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
      expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.deep.equal(
        publicKey
      );
    });

    it('should throw error if forgeModule.isForgeEnabledOn returns undefined', async () => {
      isForgeEnabledOnStub.returns(undefined);

      await expect(instance.forgingDisable(params)).to.be.rejectedWith(
        'Forging is already disabled'
      );
    });

    it('should call accounts.getAccount', async () => {
      await instance.forgingDisable(params);

      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args.length).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
        publicKey: Buffer.from(publicKey, 'hex'),
      });
    });

    it('should throw error if account not found', async () => {
      getAccountStub.resolves(false);

      await expect(instance.forgingDisable(params)).to.be.rejectedWith(
        'Account not found'
      );
    });

    it('should throw error if delegate not found', async () => {
      getAccountStub.resolves({});

      await expect(instance.forgingDisable(params)).to.be.rejectedWith(
        'Delegate not found'
      );
    });

    it('should call forgeModule.disableForge', async () => {
      await instance.forgingDisable(params);

      expect(disableForgeStub.calledOnce).to.be.true;
      expect(disableForgeStub.firstCall.args.length).to.be.equal(1);
      expect(disableForgeStub.firstCall.args[0]).to.be.deep.equal(publicKey);
    });
  });
});
