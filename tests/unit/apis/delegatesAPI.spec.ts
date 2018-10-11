import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { DelegatesAPI } from '../../../src/apis';
import * as helpers from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import {
  AccountsModuleStub,
  BlocksModuleStub,
  BlocksSubmoduleUtilsStub,
  DelegatesModuleStub,
  EdStub,
  SlotsStub,
  SystemModuleStub,
  ZSchemaStub,
} from '../../stubs';
import { ForgeModuleStub } from '../../stubs/modules/ForgeModuleStub';
import { createContainer } from '../../utils/containerCreator';
import { Accounts2DelegatesModel, AccountsModel, BlocksModel } from '../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/delegatesAPI', () => {

  let sandbox: SinonSandbox;
  let container: Container;
  let instance: DelegatesAPI;
  let schema: ZSchemaStub;
  let accounts: AccountsModuleStub;
  let blocks: BlocksModuleStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let delegatesModule: DelegatesModuleStub;
  let ed: EdStub;
  let forgeModule: ForgeModuleStub;
  let slots: SlotsStub;
  let system: SystemModuleStub;
  let cryptoCreateHashSpy;
  let accountsModel: typeof AccountsModel;
  let accounts2delegatesModel: typeof Accounts2DelegatesModel;
  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.bind(Symbols.api.delegates).to(DelegatesAPI);

    schema              = container.get(Symbols.generic.zschema);
    accounts            = container.get(Symbols.modules.accounts);
    accountsModel       = container.get(Symbols.models.accounts);
    blocks              = container.get(Symbols.modules.blocks);
    blocksUtils         = container.get(Symbols.modules.blocksSubModules.utils);
    delegatesModule     = container.get(Symbols.modules.delegates);
    ed                  = container.get(Symbols.helpers.ed);
    forgeModule         = container.get(Symbols.modules.forge);
    slots               = container.get(Symbols.helpers.slots);
    system              = container.get(Symbols.modules.system);
    cryptoCreateHashSpy = sandbox.spy(crypto, 'createHash');
    instance            = container.get(Symbols.api.delegates);
    accounts2delegatesModel = container.get(Symbols.models.accounts2Delegates);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDelegates', () => {

    const extraAccountData = {
      approval      : undefined,
      address       : null,
      missedblocks  : undefined,
      producedblocks: undefined,
      productivity  : undefined,
      username      : undefined,
      vote          : '0',
      votesWeight   : undefined,
    };
    let data;
    let d;

    // helper to set a returned object with delegates from elegatesModule.getDelegates method
    const setReturnedDelegates = (sortField, sortMethod, areNumberValues = true, limit = 3, offset = 0) => {
      let field;
      if (sortField) {
        field = sortField;
      } else {
        field = 'f';
      }

      const delegates = [
        {
          delegate: new AccountsModel({
            publicKey: Buffer.from('aa', 'hex'),
            [field]  : areNumberValues ? 1 : 'a'
          }), info: { rank: 1, [field]: areNumberValues ? 1 : 'a' }
        },
        {
          delegate: new AccountsModel({
            publicKey: Buffer.from('bb', 'hex'),
            [field]  : areNumberValues ? 3 : 'bb'
          }), info: { rank: 2, [field]: areNumberValues ? 3 : 'bb' }
        },
        {
          delegate: new AccountsModel({
            publicKey: Buffer.from('cc', 'hex'),
            [field]  : areNumberValues ? 2 : 'ccc'
          }), info: { rank: 3, [field]: areNumberValues ? 2 : 'ccc' }
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

      delegatesModule.enqueueResponse('getDelegates', Promise.resolve(d));
    };

    beforeEach(() => {
      data = {
        limit  : 'limit',
        offset : 'offset',
        orderBy: 'orderBy',
      };
    });

    it('should call delegatesModule.getDelegates', async () => {
      setReturnedDelegates('approval', 'ASC');
      await instance.getDelegates(data);

      expect(delegatesModule.stubs.getDelegates.calledOnce).to.be.true;
      expect(delegatesModule.stubs.getDelegates.firstCall.args.length).to.be.equal(1);
      expect(delegatesModule.stubs.getDelegates.firstCall.args[0]).to.be.deep.equal(data);
    });

    describe('sorting', () => {

      it('sortField === approval, sortMethod === ASC', async () => {
        setReturnedDelegates('approval', 'ASC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { ...extraAccountData, approval: 1, rank: 1, rate: 1, publicKey: 'aa' },
            { ...extraAccountData, approval: 2, rank: 3, rate: 3, publicKey: 'cc' },
            { ...extraAccountData, approval: 3, rank: 2, rate: 2, publicKey: 'bb' },
          ]);
      });

      it('sortField === approval, sortMethod !== ASC', async () => {
        setReturnedDelegates('approval', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { ...extraAccountData, approval: 3, rank: 2, rate: 2, publicKey: 'bb' },
            { ...extraAccountData, approval: 2, rank: 3, rate: 3, publicKey: 'cc' },
            { ...extraAccountData, approval: 1, rank: 1, rate: 1, publicKey: 'aa' },
          ]);
      });

      it('sortField === username, sortMethod === ASC', async () => {
        setReturnedDelegates('username', 'ASC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { ...extraAccountData, username: 'a', rank: 1, rate: 1, publicKey: 'aa' },
            { ...extraAccountData, username: 'bb', rank: 2, rate: 2, publicKey: 'bb' },
            { ...extraAccountData, username: 'ccc', rank: 3, rate: 3, publicKey: 'cc' },
          ]);
      });

      it('sortField === username, sortMethod !== ASC', async () => {
        setReturnedDelegates('username', 'DESC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { ...extraAccountData, username: 'ccc', rank: 3, rate: 3, publicKey: 'cc' },
            { ...extraAccountData, username: 'bb', rank: 2, rate: 2, publicKey: 'bb'  },
            { ...extraAccountData, username: 'a', rank: 1, rate: 1, publicKey: 'aa' },
          ]);
      });

      it('sortField state is null', async () => {
        setReturnedDelegates(null, 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          { ...extraAccountData, rank: 1, rate: 1, publicKey: 'aa' },
          { ...extraAccountData, rank: 2, rate: 2, publicKey: 'bb' },
          { ...extraAccountData, rank: 3, rate: 3, publicKey: 'cc' }
          ]);
      });

      it('sortField state is not to same the allowed fields', async () => {
        setReturnedDelegates('NICKBORSUK', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([
          { ...extraAccountData, rank: 1, rate: 1, publicKey: 'aa' },
          { ...extraAccountData, rank: 2, rate: 2, publicKey: 'bb' },
          { ...extraAccountData, rank: 3, rate: 3, publicKey: 'cc' }
        ]);
      });
    });

    it('check slice array by offset', async () => {
      setReturnedDelegates('approval', 'ASC', true, undefined, 2);
      const ret = await instance.getDelegates(data);

      expect(ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate'])))
        .to.be.deep.equal([{ approval: 3, rank: 2, rate: 2 }]);
    });

    it('check slice array by limit', async () => {
      setReturnedDelegates('approval', 'ASC', true, 1);
      const ret = await instance.getDelegates(data);

      expect(ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate'])))
        .to.be.deep.equal([{ approval: 1, rank: 1, rate: 1 }]);
    });

    it('should return an object with a delegates array and a totalCount', async () => {
      setReturnedDelegates('approval', 'ASC');
      const ret = await instance.getDelegates(data);

      expect(ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate'])))
        .to.be.deep.equal([
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

    beforeEach(() => {
      params = { height: 1 };
      f      = { fees: { delegate: 'delegate' }, otherField: 'KNOCK' };

      system.enqueueResponse('getFees', f);
    });

    it('should call system.getFees', async () => {
      await instance.getFee(params);

      expect(system.stubs.getFees.calledOnce).to.be.true;
      expect(system.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(system.stubs.getFees.firstCall.args[0]).to.be.equal(1);
    });

    it('should delete field fees from f', async () => {
      await instance.getFee(params);

      expect(f).to.not.have.property('fees');
    });

    it('should return an object with the properties fee and otherField', async () => {
      const ret = await instance.getFee(params);

      expect(ret).to.be.deep.equal({
        fee       : 'delegate',
        otherField: 'KNOCK',
      });
    });

  });

  describe('getForgedByAccount', () => {

    let params;

    describe('if params.start or params.end isn"t undefined', () => {

      let reward;

      beforeEach(() => {
        reward = {
          count  : 1,
          fees   : 5,
          rewards: 5,
        };
        params = {
          end               : 10,
          generatorPublicKey: 'generatorPublicKey',
          start             : 0,
        };
        blocksUtils.enqueueResponse('aggregateBlockReward', Promise.resolve(reward));
      });

      it('only params.start is not undefined', async () => {
        delete params.end;
        await instance.getForgedByAccount(params);

        expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
      });

      it('only params.end is not undefined', async () => {
        delete params.start;
        await instance.getForgedByAccount(params);

        expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
      });

      it('should call this.blocksUtils.aggregateBlockReward', async () => {
        await instance.getForgedByAccount(params);

        expect(blocksUtils.stubs.aggregateBlockReward.calledOnce).to.be.true;
        expect(blocksUtils.stubs.aggregateBlockReward.firstCall.args.length).to.be.equal(1);
        expect(blocksUtils.stubs.aggregateBlockReward.firstCall.args[0]).to.be.deep.equal({ ...params });
      });

      it('should return an object with the properties: count, fees, rewards and forged', async () => {
        const ret = await instance.getForgedByAccount(params);

        expect(ret).to.be.deep.equal({
          ...reward,
          forged: '10',
        });
      });

    });

    describe('if params.start and params.end are undefined', () => {

      let account;

      beforeEach(() => {
        account = {
          fees   : 5,
          rewards: 5,
        };
        params  = {
          generatorPublicKey: 'generatorPublicKey',
        };
        accounts.enqueueResponse('getAccount', Promise.resolve(account));
      });

      it('should call this.blocksUtils.aggregateBlockReward', async () => {
        await instance.getForgedByAccount(params);

        expect(accounts.stubs.getAccount.calledOnce).to.be.true;
        expect(accounts.stubs.getAccount.firstCall.args.length).to.be.equal(2);
        expect(accounts.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: Buffer.from(params.generatorPublicKey, 'hex') });
        expect(accounts.stubs.getAccount.firstCall.args[1]).to.be.deep.equal(['fees', 'rewards']);
      });

      it('thould throw error if account not found', async () => {
        accounts.reset();
        accounts.enqueueResponse('getAccount', Promise.resolve(null));

        await expect(instance.getForgedByAccount(params)).to.be.rejectedWith('Account not found');
      });

      it('should return an object with the properties: fees, forged and rewards', async () => {
        const ret = await instance.getForgedByAccount(params);

        expect(ret).to.be.deep.equal(
          {
            fees   : 5,
            forged : '10',
            rewards: 5,
          });
      });

    });
  });

  describe('getDelegate', () => {

    let params;
    let delegates;

    beforeEach(() => {
      params = {
        publicKey: 'publicKey',
        username : 'username',
      };
      delegates = [
        {
          delegate: new AccountsModel({
            publicKey: Buffer.from('aaaa', 'hex'),
            username : 'username',
          }),
          info    : {
            rank        : 1,
            approval    : 1,
            productivity: 100
          }
        },
        {
          delegate: new AccountsModel({
            publicKey: Buffer.from('1111', 'hex'),
            username : '222',
          }),
          info    : {
            rank        : 2,
            approval    : 1,
            productivity: 100
          }
        }];
      delegatesModule.enqueueResponse('getDelegates', Promise.resolve({ delegates }));
    });

    it('should call delegatesModule.getDelegates', async () => {
      await instance.getDelegate(params);
      expect(delegatesModule.stubs.getDelegates.calledOnce).to.be.true;
      expect(delegatesModule.stubs.getDelegates.firstCall.args.length).to.be.equal(1);
      expect(delegatesModule.stubs.getDelegates.firstCall.args[0]).to.be.deep.equal({ orderBy: 'username:asc' });
    });

    it('should return an object with the property: delegate', async () => {
      const ret      = await instance.getDelegate(params);
      const expected = {
        delegate: {
          ... delegates[0].delegate.toPOJO(),
          ...delegates[0].info,
          rate: delegates[0].info.rank
        }
      };
      delete expected.delegate.secondPublicKey;
      expect(ret).to.be.deep.equal(expected);
    });

    it('should throw error if no delegate matches found', async () => {
      delegatesModule.reset();
      delegatesModule.enqueueResponse('getDelegates', Promise.resolve({ delegates: [] }));

      await expect(instance.getDelegate(params)).to.be.rejectedWith('Delegate not found');
    });

  });

  describe('getVoters', () => {

    let params;
    let row;
    let accountsObject;
    let accounts2DelegatesModel: typeof Accounts2DelegatesModel;
    let findAllStub: SinonStub;
    beforeEach(() => {
      row                     = { accountIds: [{}] };
      accountsObject          = {};
      params                  = { publicKey: 'publicKey' };
      accounts2DelegatesModel = container.get<any>(Symbols.models.accounts2Delegates);
      findAllStub             = sandbox.stub(accounts2DelegatesModel, 'findAll').resolves([]);
      accounts.enqueueResponse('getAccounts', Promise.resolve([]));
    });

    it('should correctly query Accounts2DelegatesModel', async () => {
      await instance.getVoters({ publicKey: 'aa' });
      expect(findAllStub.firstCall.args[0]).to.be.deep.eq({
        attributes: ['accountId'],
        where     : { dependentId: 'aa' },
      });
    });
    it('should correctly query accountsModule.getAccounts', async () => {
      findAllStub.resolves([{ accountId: '1' }, { accountId: '2' }]);
      accounts.stubs.getAccounts.resolves([new AccountsModel(), new AccountsModel()]);
      await instance.getVoters({ publicKey: 'aa' });
      expect(accounts.stubs.getAccounts.firstCall.args[0]).to.be.deep.eq({
        sort   : 'balance',
        address: { $in: ['1', '2'] }
      });
    });

    it('should return subset of accounts infos', async () => {
      accounts.stubs.getAccounts.resolves([
        new AccountsModel({ address: '1', publicKey: Buffer.from('aa', 'hex') }),
        new AccountsModel({ address: '2', publicKey: Buffer.from('bb', 'hex') })
      ]);
      const res = await instance.getVoters(params);
      expect(res).to.be.deep.eq({
        accounts: [
          { address: '1', publicKey: 'aa' },
          { address: '2', publicKey: 'bb' }
        ],
      });
    });

  });

  describe('search', () => {
    let params;
    let orderBy;
    let queryStub: SinonStub;

    beforeEach(() => {
      orderBy = {
        sortField : 'sortField',
        sortMethod: 'sortMethod',
      };
      params  = {
        limit  : 5,
        orderBy: 'username',
        q      : 'query',
      };

      queryStub = sandbox.stub(accountsModel.sequelize, 'query').resolves([]);

    });
    it('should query by name', async () => {
      await instance.search({ q: 'vek' });
      expect(queryStub.firstCall.args[0]).to.be.deep.eq(`
    WITH
      supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
      delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
        m.username,
        m.address,
        ENCODE(m."publicKey", 'hex') AS "publicKey",
        m.vote,
        m."votesWeight",
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
      await instance.search({ q: '1\' or \'1=1', orderBy: 'username:desc', limit: 10 });
      expect(queryStub.firstCall.args[0]).to.be.deep.eq(`
    WITH
      supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
      delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
        m.username,
        m.address,
        ENCODE(m."publicKey", 'hex') AS "publicKey",
        m.vote,
        m."votesWeight",
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
      expect(res).to.be.deep.eq({count: 1});
      expect(stub.called).is.true;
    });

  });

  describe('getNextForgers', () => {

    let limit;
    let activeDelegates;
    let currentSlot;
    let currentBlockSlot;

    beforeEach(() => {
      limit                     = 3;
      activeDelegates           = [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex'), Buffer.from('cc', 'hex')];
      currentSlot               = 1;
      currentBlockSlot          = 1;
      (blocks as any).lastBlock = new BlocksModel({
        height: 5, timestamp: 2,
        generatorPublicKey: new Buffer('aa'),
        payloadHash: new Buffer('aa'),
        blockSignature: new Buffer('aa'),
      });

      delegatesModule.enqueueResponse('generateDelegateList', Promise.resolve(activeDelegates));
      slots.enqueueResponse('getSlotNumber', currentSlot);
      slots.enqueueResponse('getSlotNumber', currentBlockSlot);
    });

    it('should call delegatesModule.generateDelegateList', async () => {
      await instance.getNextForgers(limit);

      expect(delegatesModule.stubs.generateDelegateList.calledOnce).to.be.true;
      expect(delegatesModule.stubs.generateDelegateList.firstCall.args.length).to.be.equal(1);
      expect(delegatesModule.stubs.generateDelegateList.firstCall.args[0]).to.be.equal(blocks.lastBlock.height);
    });

    it('should call slots.getSlotNumber twice', async () => {
      await instance.getNextForgers(limit);

      expect(slots.stubs.getSlotNumber.calledTwice).to.be.true;

      expect(slots.stubs.getSlotNumber.firstCall.args.length).to.be.equal(1);
      expect(slots.stubs.getSlotNumber.firstCall.args[0]).to.be.equal(blocks.lastBlock.timestamp);

      expect(slots.stubs.getSlotNumber.secondCall.args.length).to.be.equal(0);
    });

    it('should return an object with the properties: currentBlock, currentBlockSlot, currentSlot and delegates', async () => {
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : (blocks as any).lastBlock,
        currentBlockSlot: 1,
        currentSlot     : 1,
        delegates       : ['cc'],
      });
    });

    it('should return empty delegates array if limit = 0', async () => {
      limit     = 0;
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : (blocks as any).lastBlock,
        currentBlockSlot: 1,
        currentSlot     : 1,
        delegates       : [],
      });
    });

    it('should return empty delegates array if slots.delegates < 1', async () => {
      (slots as any).delegates = 0;
      const ret                = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : (blocks as any).lastBlock,
        currentBlockSlot: 1,
        currentSlot     : 1,
        delegates       : [],
      });
    });

  });

  describe('createDelegate', () => {

    it('should return a rejected promise', async () => {
      await expect(instance.createDelegate()).to.be.rejectedWith('Method is deprecated');
    });

  });

  describe('getForgingStatus', () => {

    let params;
    let enabled;
    let delegates;

    beforeEach(() => {
      params    = { publicKey: 'publicKey' };
      enabled   = true;
      delegates = [{}, {}];

      forgeModule.enqueueResponse('isForgeEnabledOn', enabled);
      forgeModule.enqueueResponse('getEnabledKeys', delegates);
    });

    it('param.publicKey', async () => {
      const ret = await instance.getForgingStatus(params);

      expect(ret).to.be.deep.equal({ delegates: [params.publicKey], enabled: true });

      expect(forgeModule.stubs.isForgeEnabledOn.calledOnce).to.be.true;
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args.length).to.be.equal(1);
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args[0]).to.be.equal(params.publicKey);
    });

    it('!param.publicKey', async () => {
      delete params.publicKey;
      const ret = await instance.getForgingStatus(params);

      expect(forgeModule.stubs.getEnabledKeys.calledOnce).to.be.true;
      expect(forgeModule.stubs.getEnabledKeys.firstCall.args.length).to.be.equal(0);

      expect(ret).to.be.deep.equal({ delegates, enabled: true });
    });

  });

  describe('forgingEnable', () => {

    let params;
    let kp;
    let publicKey;
    let account;
    let hash;

    beforeEach(() => {
      account   = { isDelegate: true };
      publicKey = 'publicKey';
      params    = {
        publicKey,
        secret: 'secret',
      };
      kp        = { publicKey };
      hash      = crypto.createHash('sha256').update('secret', 'utf8')
        .digest();

      ed.enqueueResponse('makeKeypair', kp);
      forgeModule.enqueueResponse('isForgeEnabledOn', false);
      forgeModule.enqueueResponse('enableForge', {});
      accounts.enqueueResponse('getAccount', account);
    });

    it('should call ed.makeKeypair', async () => {
      await instance.forgingEnable(params);

      expect(ed.stubs.makeKeypair.calledOnce).to.be.true;
      expect(ed.stubs.makeKeypair.firstCall.args.length).to.be.equal(1);
      expect(ed.stubs.makeKeypair.firstCall.args[0]).to.be.deep.equal(hash);
    });

    it('should call crypto.createHash', async () => {
      await instance.forgingEnable(params);

      // the first call in beforeEach hook
      expect(cryptoCreateHashSpy.calledTwice).to.be.true;
      expect(cryptoCreateHashSpy.secondCall.args.length).to.be.equal(1);
      expect(cryptoCreateHashSpy.secondCall.args[0]).to.be.equal('sha256');
    });

    it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
      ed.reset();
      ed.enqueueResponse('makeKeypair', { publicKey: 'sss' });

      await expect(instance.forgingEnable(params)).to.be.rejectedWith('Invalid passphrase');
    });

    it('should call forgeModule.isForgeEnabledOn', async () => {
      await instance.forgingEnable(params);

      expect(forgeModule.stubs.isForgeEnabledOn.calledOnce).to.be.true;
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args.length).to.be.equal(1);
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args[0]).to.be.deep.equal('publicKey');
    });

    it('should throw error if forgeModule.isForgeEnabledOn returns true', async () => {
      forgeModule.reset();
      forgeModule.enqueueResponse('isForgeEnabledOn', true);

      await expect(instance.forgingEnable(params)).to.be.rejectedWith('Forging is already enabled');
    });

    it('should call accounts.getAccount', async () => {
      await instance.forgingEnable(params);

      expect(accounts.stubs.getAccount.calledOnce).to.be.true;
      expect(accounts.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accounts.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: 'publicKey' });
    });

    it('should throw error if account not found', async () => {
      accounts.reset();
      accounts.enqueueResponse('getAccount', false);

      await expect(instance.forgingEnable(params)).to.be.rejectedWith('Account not found');
    });

    it('should throw error if delegate not found', async () => {
      accounts.reset();
      accounts.enqueueResponse('getAccount', {});

      await expect(instance.forgingEnable(params)).to.be.rejectedWith('Delegate not found');
    });

    it('should call forgeModule.enableForge', async () => {
      await instance.forgingEnable(params);

      expect(forgeModule.stubs.enableForge.calledOnce).to.be.true;
      expect(forgeModule.stubs.enableForge.firstCall.args.length).to.be.equal(1);
      expect(forgeModule.stubs.enableForge.firstCall.args[0]).to.be.deep.equal({ publicKey: 'publicKey' });
    });

  });

  describe('forgingDisable', () => {

    let params;
    let kp;
    let publicKey;
    let account;
    let hash;

    beforeEach(() => {
      account   = { isDelegate: true };
      publicKey = 'publicKey';
      params    = {
        publicKey,
        secret: 'secret',
      };
      kp        = { publicKey };
      hash      = crypto.createHash('sha256').update('secret', 'utf8')
        .digest();

      ed.enqueueResponse('makeKeypair', kp);
      forgeModule.enqueueResponse('isForgeEnabledOn', true);
      forgeModule.enqueueResponse('disableForge', {});
      accounts.enqueueResponse('getAccount', account);
    });

    it('should call ed.makeKeypair', async () => {
      await instance.forgingDisable(params);

      expect(ed.stubs.makeKeypair.calledOnce).to.be.true;
      expect(ed.stubs.makeKeypair.firstCall.args.length).to.be.equal(1);
      expect(ed.stubs.makeKeypair.firstCall.args[0]).to.be.deep.equal(hash);
    });

    it('should call crypto.createHash', async () => {
      await instance.forgingDisable(params);

      // the first call in beforeEach hook
      expect(cryptoCreateHashSpy.calledTwice).to.be.true;
      expect(cryptoCreateHashSpy.secondCall.args.length).to.be.equal(1);
      expect(cryptoCreateHashSpy.secondCall.args[0]).to.be.equal('sha256');
    });

    it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
      ed.reset();
      ed.enqueueResponse('makeKeypair', { publicKey: 'sss' });

      await expect(instance.forgingDisable(params)).to.be.rejectedWith('Invalid passphrase');
    });

    it('should call forgeModule.isForgeEnabledOn', async () => {
      await instance.forgingDisable(params);

      expect(forgeModule.stubs.isForgeEnabledOn.calledOnce).to.be.true;
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args.length).to.be.equal(1);
      expect(forgeModule.stubs.isForgeEnabledOn.firstCall.args[0]).to.be.deep.equal('publicKey');
    });

    it('should throw error if forgeModule.isForgeEnabledOn returns undefined', async () => {
      forgeModule.reset();
      forgeModule.enqueueResponse('isForgeEnabledOn', undefined);

      await expect(instance.forgingDisable(params)).to.be.rejectedWith('Forging is already disabled');
    });

    it('should call accounts.getAccount', async () => {
      await instance.forgingDisable(params);

      expect(accounts.stubs.getAccount.calledOnce).to.be.true;
      expect(accounts.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accounts.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: 'publicKey' });
    });

    it('should throw error if account not found', async () => {
      accounts.reset();
      accounts.enqueueResponse('getAccount', false);

      await expect(instance.forgingDisable(params)).to.be.rejectedWith('Account not found');
    });

    it('should throw error if delegate not found', async () => {
      accounts.reset();
      accounts.enqueueResponse('getAccount', {});

      await expect(instance.forgingDisable(params)).to.be.rejectedWith('Delegate not found');
    });

    it('should call forgeModule.disableForge', async () => {
      await instance.forgingDisable(params);

      expect(forgeModule.stubs.disableForge.calledOnce).to.be.true;
      expect(forgeModule.stubs.disableForge.firstCall.args.length).to.be.equal(1);
      expect(forgeModule.stubs.disableForge.firstCall.args[0]).to.be.deep.equal('publicKey');
    });

  });

});
