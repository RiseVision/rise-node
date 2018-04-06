import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { DelegatesAPI } from '../../../src/apis/delegatesAPI';
import { Symbols } from '../../../src/ioc/symbols';
import {
AccountsModuleStub, BlocksModuleStub, BlocksSubmoduleUtilsStub, DbStub,
DelegatesModuleStub, EdStub, SlotsStub,
SystemModuleStub, ZSchemaStub,
} from '../../stubs';
import { ForgeModuleStub } from '../../stubs/modules/ForgeModuleStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

const DelegatesAPIRewire = rewire('../../../src/apis/delegatesAPI');

// tslint:disable no-unused-expression max-line-length

describe('apis/blocksAPI', () => {

  let sandbox: SinonSandbox;
  let container: Container;
  let instance: DelegatesAPI;
  let schema: ZSchemaStub;
  let accounts: AccountsModuleStub;
  let blocks: BlocksModuleStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let db: DbStub;
  let delegatesModule: DelegatesModuleStub;
  let ed: EdStub;
  let forgeModule: ForgeModuleStub;
  let slots: SlotsStub;
  let system: SystemModuleStub;
  let sql;
  let cryptoCreateHashSpy;
  let rewiredCrypto;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    container.bind(Symbols.api.delegates).to(DelegatesAPIRewire.DelegatesAPI);

    schema          = container.get(Symbols.generic.zschema);
    accounts        = container.get(Symbols.modules.accounts);
    blocks          = container.get(Symbols.modules.blocks);
    blocksUtils     = container.get(Symbols.modules.blocksSubModules.utils);
    db              = container.get(Symbols.generic.db);
    delegatesModule = container.get(Symbols.modules.delegates);
    ed              = container.get(Symbols.helpers.ed);
    forgeModule     = container.get(Symbols.modules.forge);
    slots           = container.get(Symbols.helpers.slots);
    system          = container.get(Symbols.modules.system);

    rewiredCrypto       = DelegatesAPIRewire.__get__('crypto');
    cryptoCreateHashSpy = sandbox.spy(rewiredCrypto, 'createHash');
    sql                 = DelegatesAPIRewire.__get__('delegates_2.default');

    instance = container.get(Symbols.api.delegates);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDelegates', () => {

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
        { [field]: areNumberValues ? 1 : 'a' },
        { [field]: areNumberValues ? 3 : 'bb' },
        { [field]: areNumberValues ? 2 : 'ccc' },
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
            { approval: 1 },
            { approval: 2 },
            { approval: 3 },
          ]);
      });

      it('sortField === approval, sortMethod !== ASC', async () => {
        setReturnedDelegates('approval', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { approval: 3 },
            { approval: 2 },
            { approval: 1 },
          ]);
      });

      it('sortField === username, sortMethod === ASC', async () => {
        setReturnedDelegates('username', 'ASC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { username: 'a' },
            { username: 'bb' },
            { username: 'ccc' },
          ]);
      });

      it('sortField === username, sortMethod !== ASC', async () => {
        setReturnedDelegates('username', 'DESC', false);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal(
          [
            { username: 'ccc' },
            { username: 'bb' },
            { username: 'a' },
          ]);
      });

      it('sortField state is null', async () => {
        setReturnedDelegates(null, 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([{ f: 1 }, { f: 3 }, { f: 2 }]);
      });

      it('sortField state is not to same the allowed fields', async () => {
        setReturnedDelegates('NICKBORSUK', 'DESC', true);
        const ret = await instance.getDelegates(data);

        expect(ret.delegates).to.be.deep.equal([{ NICKBORSUK: 1 }, { NICKBORSUK: 3 }, { NICKBORSUK: 2 }]);
      });
    });

    it('check slice array by offset', async () => {
      setReturnedDelegates('approval', 'ASC', true, undefined, 2);
      const ret = await instance.getDelegates(data);

      expect(ret.delegates).to.be.deep.equal([{ approval: 3 }]);
    });

    it('check slice array by limit', async () => {
      setReturnedDelegates('approval', 'ASC', true, 1);
      const ret = await instance.getDelegates(data);

      expect(ret.delegates).to.be.deep.equal([{ approval: 1 }]);
    });

    it('success', async () => {
      setReturnedDelegates('approval', 'ASC');
      const ret = await instance.getDelegates(data);

      expect(ret).to.be.deep.equal({
        delegates : [
          { approval: 1, },
          { approval: 2, },
          { approval: 3, },
        ],
        totalCount: 3,
      });
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

    it('success', async () => {
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

      it('success', async () => {
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
        expect(accounts.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: params.generatorPublicKey });
        expect(accounts.stubs.getAccount.firstCall.args[1]).to.be.deep.equal(['fees', 'rewards']);
      });

      it('thould throw error if account not found', async () => {
        accounts.reset();
        accounts.enqueueResponse('getAccount', Promise.resolve(null));

        await expect(instance.getForgedByAccount(params)).to.be.rejectedWith('Account not found');
      });

      it('success', async () => {
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
      params    = {
        publicKey: 'publicKey',
        username : 'username',
      };
      delegates = [
        {
          publicKey: 'publicKey',
          username : 'username',
        },
        {
          publicKey: '111',
          username : '222',
        }];
      delegatesModule.enqueueResponse('getDelegates', Promise.resolve({ delegates }));
    });

    it('should call delegatesModule.getDelegates', async () => {
      await instance.getDelegate(params);

      expect(delegatesModule.stubs.getDelegates.calledOnce).to.be.true;
      expect(delegatesModule.stubs.getDelegates.firstCall.args.length).to.be.equal(1);
      expect(delegatesModule.stubs.getDelegates.firstCall.args[0]).to.be.deep.equal({ orderBy: 'username:asc' });
    });

    it('success', async () => {
      const ret = await instance.getDelegate(params);

      expect(ret).to.be.deep.equal({ delegate: delegates[0] });
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

    beforeEach(() => {
      row            = { accountIds: [{}] };
      accountsObject = {};
      params         = { publicKey: 'publicKey' };
      db.enqueueResponse('one', row);
      accounts.enqueueResponse('getAccounts', accountsObject);
    });

    it('should called db.one', async () => {
      await instance.getVoters(params);

      expect(db.stubs.one.calledOnce).to.be.true;
      expect(db.stubs.one.firstCall.args.length).to.be.equal(2);
      expect(db.stubs.one.firstCall.args[0]).to.be.equal('SELECT ARRAY_AGG("accountId") AS "accountIds" FROM mem_accounts2delegates WHERE "dependentId" = ${publicKey}');
      expect(db.stubs.one.firstCall.args[1]).to.be.deep.equal({
        publicKey: 'publicKey',
      });
    });

    it('should called accounts.getAccounts', async () => {
      await instance.getVoters(params);

      expect(accounts.stubs.getAccounts.calledOnce).to.be.true;
      expect(accounts.stubs.getAccounts.firstCall.args.length).to.be.equal(2);
      expect(accounts.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        address: { $in: row.accountIds },
        sort   : 'balance',
      });
      expect(accounts.stubs.getAccounts.firstCall.args[1]).to.be.deep.equal(['address', 'balance', 'username', 'publicKey']);
    });

    it('should set addresses in default value if row.accountIds is undefined', async () => {
      db.reset();
      delete row.accountIds;
      db.enqueueResponse('one', row);

      await instance.getVoters(params);

      expect(accounts.stubs.getAccounts.firstCall.args[0]).to.be.deep.equal({
        address: { $in: [] },
        sort   : 'balance',
      });
    });

    it('success', async () => {
      const ret = await instance.getVoters(params);

      expect(ret).to.be.deep.equal({ accounts: accountsObject });
    });

  });

  describe('search', () => {

    let OrderByStub: SinonStub;
    let sqlSearchSpy: SinonSpy;
    let params;
    let orderBy;
    let constants;

    beforeEach(() => {
      orderBy   = {
        sortField : 'sortField',
        sortMethod: 'sortMethod',
      };
      params    = {
        limit  : 5,
        orderBy: 'username',
        q      : 'query',
      };
      constants = { activeDelegates: 10 };

      OrderByStub = sandbox.stub().returns(orderBy);
      DelegatesAPIRewire.__set__('_1', { OrderBy: OrderByStub, constants });

      sqlSearchSpy = sandbox.spy(sql, 'search');

      db.enqueueResponse('query', Promise.resolve({}));
    });

    it('should call OrderBy', async () => {
      await instance.search(params);

      expect(OrderByStub.calledOnce).to.be.true;
      expect(OrderByStub.firstCall.args.length).to.be.equal(2);
      expect(OrderByStub.firstCall.args[0]).to.be.equal(params.orderBy);
      expect(OrderByStub.firstCall.args[1]).to.be.deep.equal({
        sortField : 'username',
        sortFields: sql.sortFields,
      });
    });

    it('should throw error if OrderBy retuns error state', async () => {
      const error = new Error('error');
      OrderByStub.returns({ error });

      await expect(instance.search(params)).to.be.rejectedWith(error.message);
    });

    it('should call db.query', async () => {
      const sqlSearchResult = sql.search({
        ...params, ...orderBy,
      });

      await instance.search(params);

      expect(db.stubs.query.calledOnce).to.be.true;
      expect(db.stubs.query.firstCall.args.length).to.be.equal(1);
      expect(db.stubs.query.firstCall.args[0]).to.be.equal(sqlSearchResult);
    });

    it('should call sql.search', async () => {

      await instance.search(params);

      expect(sqlSearchSpy.calledOnce).to.be.true;
      expect(sqlSearchSpy.firstCall.args.length).to.be.equal(1);
      expect(sqlSearchSpy.firstCall.args[0]).to.be.deep.equal({
        limit     : 5,
        q         : '%query%',
        sortField : 'sortField',
        sortMethod: 'sortMethod',
      });
    });

    it('check of set of limit prop in default value', async () => {
      delete params.limit;

      await instance.search(params);

      expect(sqlSearchSpy.calledOnce).to.be.true;
      expect(sqlSearchSpy.firstCall.args.length).to.be.equal(1);
      expect(sqlSearchSpy.firstCall.args[0]).to.be.deep.equal({
        limit     : 10,
        q         : '%query%',
        sortField : 'sortField',
        sortMethod: 'sortMethod',
      });
    });

    it('success', async () => {
      const ret = await instance.search(params);

      expect(ret).to.be.deep.equal({ delegates: {} });
    });

  });

  describe('count', () => {

    it('should call db.one', async () => {
      db.enqueueResponse('one', { count: 1 });

      await instance.count();

      expect(db.stubs.one.calledOnce).to.be.true;
      expect(db.stubs.one.firstCall.args.length).to.be.equal(1);
      expect(db.stubs.one.firstCall.args[0]).to.be.equal(sql.count);
    });

    it('success', async () => {
      db.enqueueResponse('one', { count: 1 });

      const ret = await instance.count();

      expect(ret).to.be.deep.equal({ count: 1 });
    });

  });

  describe('getNextForgers', () => {

    let limit;
    let activeDelegates;
    let currentSlot;
    let currentBlockSlot;

    beforeEach(() => {
      limit            = 3;
      activeDelegates  = [{ del: 1 }, { del: 2 }, { del: 3 }];
      currentSlot      = 1;
      currentBlockSlot = 1;
      (blocks as any).lastBlock = { height: 5, timestamp: 2 };

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

    it('success', async () => {
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : { height: 5, timestamp: 2 },
        currentBlockSlot: 1,
        currentSlot     : 1,
        delegates       : [{ del: 3 }],
      });
    });

    it('should return empty delegates array if limit = 0', async () => {
      limit     = 0;
      const ret = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : { height: 5, timestamp: 2 },
        currentBlockSlot: 1,
        currentSlot     : 1,
        delegates       : [],
      });
    });

    it('should return empty delegates array if slots.delegates < 1', async () => {
      (slots as any).delegates = 0;
      const ret       = await instance.getNextForgers(limit);

      expect(ret).to.be.deep.equal({
        currentBlock    : { height: 5, timestamp: 2 },
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
      hash      = rewiredCrypto.createHash('sha256').update('secret', 'utf8')
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
      hash      = rewiredCrypto.createHash('sha256').update('secret', 'utf8')
        .digest();

      ed.enqueueResponse('makeKeypair', kp);
      forgeModule.enqueueResponse('isForgeEnabledOn', false);
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
