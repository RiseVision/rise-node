import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { DelegatesAPI } from '../../../src/apis/delegatesAPI';
import { Symbols } from '../../../src/ioc/symbols';
import sql from '../../../src/sql/delegates';
import {
  AccountsModuleStub, BlocksModuleStub, BlocksSubmoduleUtilsStub, DbStub,
  DelegatesModuleStub, EdStub, SlotsStub,
  SystemModuleStub, ZSchemaStub,
} from '../../stubs';
import { ForgeModuleStub } from '../../stubs/modules/ForgeModuleStub';
import { createContainer } from '../../utils/containerCreator';
import { constants } from '../../../src/helpers';

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
          generatorPublicKey: 'generatorPublicKey',
          end               : 10,
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
    let sql;
    let orderBy;
    let constants;

    beforeEach(() => {
      orderBy   = {
        sortField : 'sortField',
        sortMethod: 'sortMethod',
      };
      params    = {
        q      : 'query',
        orderBy: 'username',
        limit  : 5,
      };
      constants = { activeDelegates: 10 };

      OrderByStub = sandbox.stub().returns(orderBy);
      DelegatesAPIRewire.__set__('_1', { OrderBy: OrderByStub, constants });

      sql          = DelegatesAPIRewire.__get__('delegates_2.default');
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

  });

  describe('getNextForgers', () => {

  });

  describe('createDelegate', () => {

  });

  describe('getForgingStatus', () => {

  });

  describe('forgingEnable', () => {

  });

  describe('forgingDisable', () => {

  });

});
