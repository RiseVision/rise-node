import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import { Container } from 'inversify';
import * as path from 'path';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { LoggerStub, ZSchemaStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { IAccountLogic } from '../../../src/ioc/interfaces/logic';
import { AccountLogic } from '../../../src/logic/';
import {
  Accounts2DelegatesModel,
  Accounts2MultisignaturesModel,
  AccountsModel,
  RoundsModel
} from '../../../src/models';
import { FieldsInModel } from '../../../src/types/utils';
import { DBCreateOp, DBCustomOp, DBRemoveOp, DBUpdateOp } from '../../../src/types/genericTypes';

chai.use(chaiAsPromised);


const table = 'mem_accounts';

// tslint:disable no-unused-expression

/**
 * TODO: Better describe test cases
 * TODO: Check if more test cases are needed
 */
describe('logic/account', () => {
  let sandbox: SinonSandbox;
  let account: IAccountLogic;
  let loggerStub: LoggerStub;
  let zSchemaStub: ZSchemaStub;
  let container: Container;
  let accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  let accounts2MultisigModel: typeof Accounts2MultisignaturesModel;
  let roundsModel: typeof RoundsModel;
  let accountsModel: typeof AccountsModel;
  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.rebind(Symbols.logic.account).to(AccountLogic);
    loggerStub              = container.get(Symbols.helpers.logger);
    zSchemaStub             = container.get(Symbols.generic.zschema);
    account                 = container.get(Symbols.logic.account);
    accountsModel           = container.get(Symbols.models.accounts);
    accounts2DelegatesModel = container.get(Symbols.models.accounts2Delegates);
    roundsModel             = container.get(Symbols.models.rounds);
    accounts2MultisigModel  = container.get(Symbols.models.accounts2Multisignatures);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {

    it('fields should match', () => {
      const fields = [
        { field: 'username' },
        { field: 'isDelegate' },
        { field: 'u_isDelegate' },
        { field: 'secondSignature' },
        { field: 'u_secondSignature' },
        { field: 'u_username' },
        { expression: 'UPPER("address")', alias: 'address' },
        { expression: 'ENCODE("publicKey", \'hex\')', alias: 'publicKey' },
        {
          alias     : 'secondPublicKey',
          expression: 'ENCODE("secondPublicKey", \'hex\')',
        },
        { expression: '("balance")::bigint', alias: 'balance' },
        { expression: '("u_balance")::bigint', alias: 'u_balance' },
        { expression: '("vote")::bigint', alias: 'vote' },
        { expression: '("rate")::bigint', alias: 'rate' },
        {
          alias     : 'delegates',
          expression:
            '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2delegates WHERE "accountId" = a."address")',
        },
        {
          alias     : 'u_delegates',
          expression:
            '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_delegates WHERE "accountId" = a."address")',
        },
        {
          alias     : 'multisignatures',
          expression:
            '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2multisignatures WHERE "accountId" = a."address")',
        },
        {
          alias     : 'u_multisignatures',
          expression:
            '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_multisignatures WHERE "accountId" = a."address")',
        },
        { field: 'multimin' },
        { field: 'u_multimin' },
        { field: 'multilifetime' },
        { field: 'u_multilifetime' },
        { field: 'blockId' },
        { field: 'producedblocks' },
        { field: 'missedblocks' },
        { expression: '("fees")::bigint', alias: 'fees' },
        { expression: '("rewards")::bigint', alias: 'rewards' },
        { field: 'virgin' },
      ];
      expect(account.fields).to.deep.equal(fields);
    });

    it('filter should match', () => {
      const filter = {
        address          : {
          case     : 'upper',
          maxLength: 22,
          minLength: 1,
          required : true,
          type     : 'string',
        },
        balance          : {
          maximum : 10999999991000000,
          minimum : 0,
          required: true,
          type    : 'integer',
        },
        blockId          : { type: 'string', minLength: 1, maxLength: 20 },
        delegates        : { type: 'array', uniqueItems: true },
        fees             : { type: 'integer' },
        isDelegate       : { type: 'boolean' },
        missedblocks     : { type: 'integer', minimum: -1, maximum: 1 },
        multilifetime    : { type: 'integer', minimum: 1, maximum: 72 },
        multimin         : { type: 'integer', minimum: 0, maximum: 17 },
        multisignatures  : { type: 'array', uniqueItems: true },
        producedblocks   : { type: 'integer', minimum: -1, maximum: 1 },
        publicKey        : { type: 'string', format: 'publicKey' },
        rate             : { type: 'integer' },
        rewards          : { type: 'integer' },
        secondPublicKey  : { type: 'string', format: 'publicKey' },
        secondSignature  : { type: 'boolean' },
        u_balance        : {
          maximum : 10999999991000000,
          minimum : 0,
          required: true,
          type    : 'integer',
        },
        u_delegates      : { type: 'array', uniqueItems: true },
        u_isDelegate     : { type: 'boolean' },
        u_multilifetime  : { type: 'integer', minimum: 1, maximum: 72 },
        u_multimin       : { type: 'integer', minimum: 0, maximum: 17 },
        u_multisignatures: { type: 'array', uniqueItems: true },
        u_secondSignature: { type: 'boolean' },
        u_username       : {
          case     : 'lower',
          maxLength: 20,
          minLength: 1,
          type     : 'string',
        },
        username         : {
          case     : 'lower',
          maxLength: 20,
          minLength: 1,
          type     : 'string',
        },
        virgin           : { type: 'boolean' },
        vote             : { type: 'integer' },
      };
      expect(account.filter).to.deep.equal(filter);
    });

    it('conv should match', () => {
      const conv = {
        address          : String,
        balance          : Number,
        blockId          : String,
        delegates        : Array,
        fees             : Number,
        isDelegate       : Boolean,
        missedblocks     : Number,
        multilifetime    : Number,
        multimin         : Number,
        multisignatures  : Array,
        producedblocks   : Number,
        publicKey        : String,
        rate             : Number,
        rewards          : Number,
        secondPublicKey  : String,
        secondSignature  : Boolean,
        u_balance        : Number,
        u_delegates      : Array,
        u_isDelegate     : Boolean,
        u_multilifetime  : Number,
        u_multimin       : Number,
        u_multisignatures: Array,
        u_secondSignature: Boolean,
        u_username       : String,
        username         : String,
        virgin           : Boolean,
        vote             : Number,
      };
      expect(account.conv).to.deep.equal(conv);
    });

    it('editable', () => {
      const editable = [
        'isDelegate',
        'u_isDelegate',
        'secondSignature',
        'u_secondSignature',
        'balance',
        'u_balance',
        'vote',
        'rate',
        'delegates',
        'u_delegates',
        'multisignatures',
        'u_multisignatures',
        'multimin',
        'u_multimin',
        'multilifetime',
        'u_multilifetime',
        'blockId',
        'producedblocks',
        'missedblocks',
        'fees',
        'rewards',
      ];
      expect(account.editable).to.deep.equal(editable);
    });
  });

  describe('account.createTables', () => {
    const sqlPath = path.join(process.cwd(), 'sql', 'memoryTables.sql');

    it('should handle sql error', async () => {
      const error = new Error('error');
      sandbox.stub(accountsModel.sequelize, 'query').rejects(error);
      await expect(account.createTables()).to.be.rejectedWith('error');
    });
    it('should call accountsModel.sequelize.query with memoryTables content', async () => {
      const content = fs.readFileSync(sqlPath, { encoding: 'utf8' });
      const stub    = sandbox.stub(accountsModel.sequelize, 'query').resolves(null);
      await account.createTables();

      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq(content);
    });
  });

  describe('account.removeTables', () => {
    let dropStubs: { [s: string]: SinonStub } = {};
    beforeEach(() => {
      [Symbols.models.accounts,
        Symbols.models.accounts2Multisignatures,
        Symbols.models.accounts2U_Multisignatures,
        Symbols.models.accounts2Delegates,
        Symbols.models.accounts2U_Delegates,
        Symbols.models.rounds].forEach((s) => dropStubs[s] = sandbox.stub(container.get<any>(s), 'drop').resolves());
    });
    it('should call .drop on all models', async () => {
      await account.removeTables();
      [Symbols.models.accounts,
        Symbols.models.accounts2Multisignatures,
        Symbols.models.accounts2U_Multisignatures,
        Symbols.models.accounts2Delegates,
        Symbols.models.accounts2U_Delegates,
        Symbols.models.rounds].forEach((s) => {
        expect(dropStubs[s].called).is.true;
      });
    });
    it('should remap rejection', async () => {
      dropStubs[Symbols.models.accounts].rejects(new Error('hey'));
      await expect(account.removeTables()).to.be.rejectedWith('Account#removeTables error');
    });
  });

  describe('account.objectNormalize', () => {
    const accountData = {};

    it('should handle validation error', () => {
      const errors       = [{ message: 'error 1' }, { message: 'error 2' }];
      const errorMessage =
              'Failed to validate account schema: ' +
              errors
                .map((error) => error.message)
                .join(', ');

      zSchemaStub.enqueueResponse('validate', false);
      zSchemaStub.enqueueResponse('getLastErrors', errors);
      // it should throw an error as expected
      expect(account.objectNormalize.bind(account, accountData)).to.throw(
        errorMessage
      );
      // it should call validate correctly
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.getCall(0).args.length).to.equal(2);
      expect(zSchemaStub.stubs.validate.getCall(0).args[0]).to.equal(accountData);
      expect(zSchemaStub.stubs.validate.getCall(0).args[1]).to.deep.equal({
        id        : 'Account',
        object    : true,
        properties: account.filter,
      });
      // it should call getLastErrors
      expect(zSchemaStub.stubs.getLastErrors.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.getLastErrors.getCall(0).args.length).to.equal(0);
    });

    it('should normalize object', () => {
      zSchemaStub.enqueueResponse('validate', true);
      // it should not modify the object
      expect(account.objectNormalize(accountData)).to.equal(accountData);
      // it should call validate correctly
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.getCall(0).args.length).to.equal(2);
      expect(zSchemaStub.stubs.validate.getCall(0).args[0]).to.equal(accountData);
      expect(zSchemaStub.stubs.validate.getCall(0).args[1]).to.deep.equal({
        id        : 'Account',
        object    : true,
        properties: account.filter,
      });
    });
  });

  describe('account.assertPublicKey', () => {
    it('public key is not a string error', () => {
      const error = 'Invalid public key, must be a string';
      expect(() => account.assertPublicKey(null)).to.throw(error);
    });

    it('public key is too short error', () => {
      const error = 'Invalid public key, must be 64 characters long';
      expect(() => account.assertPublicKey('short string')).to.throw(error);
    });

    it('should call through schema hex validation.', () => {
      zSchemaStub.enqueueResponse('validate', false);
      const publicKey = '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da';
      expect(() => account.assertPublicKey(publicKey)).to.throw('Invalid public key, must be a hex string');
      expect(zSchemaStub.stubs.validate.calledOnce).is.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.eq(publicKey);
      expect(zSchemaStub.stubs.validate.firstCall.args[1]).to.be.deep.eq({ format: 'hex' });
    });

    it('publicKey is undefined & allowUndefined is false', () => {
      const error = 'Public Key is undefined';
      expect(() => account.assertPublicKey(undefined, false)).to.throw(error);
    });
  });

  describe('account.get', () => {
    const data   = ['some data'];
    const filter = {};
    let getAllStub: SinonStub;
    beforeEach(() => {
      getAllStub = sandbox.stub(account, 'getAll');
    });

    it('without fields; getAll error', async () => {
      const error = 'error';

      getAllStub.rejects(new Error(error));

      await expect(account.get(filter)).to.be.rejectedWith('error');
      expect(getAllStub.calledOnce).is.true;
      expect(getAllStub.firstCall.args[0]).to.be.deep.eq(filter);
    });

    it('with fields; should propagate it', async () => {
      const error                                = 'error';
      const fields: FieldsInModel<AccountsModel> = ['username'];
      getAllStub.rejects(new Error(error));
      await expect(account.get(filter, fields)).to.be.rejectedWith('error');
      expect(getAllStub.calledOnce).is.true;
      expect(getAllStub.firstCall.args[0]).to.be.deep.eq(filter);
      expect(getAllStub.firstCall.args[1]).to.be.deep.eq(fields);
    });

    it('should return first returned element from getAll', async () => {
      getAllStub.resolves(['1', '2']);
      const res = await account.get(filter);
      expect(res).to.be.deep.eq('1');
    });
    it('should return undefined if no matching elements', async () => {
      getAllStub.resolves([]);
      const res = await account.get(filter);
      expect(res).to.be.undefined;
    });
  });

  describe('account.getAll', () => {
    let filter: any;
    let fields: any[];
    let sql: string;
    let shortSql: string;
    let rows: any[];

    let scopeStub: SinonStub;
    let findAllStub: SinonStub;
    beforeEach(() => {
      const scope = {
        findAll() {
          return void 0;
        },
      };
      scopeStub   = sandbox.stub(accountsModel, 'scope').returns(scope);
      findAllStub = sandbox.stub(scope, 'findAll').resolves([]);
    });

    beforeEach(() => {
      filter   = {
        address: '2841811297332056155r',
        limit  : 4,
        offset : 2,
        sort   : 'username',
      };
      fields   = [];
      sql      = 'select "username", "isDelegate", "u_isDelegate", "secondSignature", "u_secondSignature", ' +
        '"u_username", UPPER("address") as "address", ENCODE("publicKey", \'hex\') as "publicKey", ' +
        'ENCODE("secondPublicKey", \'hex\') as "secondPublicKey", ("balance")::bigint as "balance", ' +
        '("u_balance")::bigint as "u_balance", ("vote")::bigint as "vote", ("rate")::bigint as "rate", ' +
        '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2delegates WHERE "accountId" = a."address") ' +
        'as "delegates", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_delegates WHERE "accountId" = ' +
        'a."address") as "u_delegates", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2multisignatures ' +
        'WHERE "accountId" = a."address") as "multisignatures", (SELECT ARRAY_AGG("dependentId") FROM ' +
        'mem_accounts2u_multisignatures WHERE "accountId" = a."address") as "u_multisignatures", "multimin",' +
        ' "u_multimin", "multilifetime", "u_multilifetime", "blockId", "nameexist", "u_nameexist", ' +
        '"producedblocks", "missedblocks", ("fees")::bigint as "fees", ("rewards")::bigint as "rewards", ' +
        '"virgin" from "mem_accounts" as "a" where upper("address") = upper(${p1}) order by "username" limit' +
        ' 4 offset 2;';
      shortSql = 'select * from "mem_accounts" as "a" where upper("address") = upper(${p1}) order by "username" ' +
        'limit 4 offset 2;';
      rows     = [];
    });

    describe('scopes', () => {
      it('should use full scope when u_delegates is provided', async () => {
        await account.getAll({ address: '1' }, ['u_delegates']);
        expect(scopeStub.calledWith('full')).is.true;
      });
      it('should use full scope when u_multisignatures is provided', async () => {
        await account.getAll({ address: '1' }, ['u_multisignatures']);
        expect(scopeStub.calledWith('full')).is.true;
      });
      it('should use fullConfirmed scope when multisignatures is provided', async () => {
        await account.getAll({ address: '1' }, ['multisignatures']);
        expect(scopeStub.calledWith('fullConfirmed')).is.true;
      });
      it('should use fullConfirmed scope when delegates is provided', async () => {
        await account.getAll({ address: '1' }, ['delegates']);
        expect(scopeStub.calledWith('fullConfirmed')).is.true;
      });
      it('should use null scope when none of the above is provided (but the rest is)', async () => {
        await account.getAll({ address: '1' }, [
          'username',
          'isDelegate',
          'secondSignature',
          'address',
          'publicKey',
          'secondPublicKey',
          'balance',
          'vote',
          'rate',
          'multimin',
          'multilifetime',
          'blockId',
          'producedblocks',
          'missedblocks',
          'fees',
          'rewards',
          'virgin',
          'u_isDelegate',
          'u_secondSignature',
          'u_username',
          'u_balance',
          'u_multilifetime',
          'u_multimin',
        ]);
        expect(scopeStub.calledWith(null)).is.true;
      });
    });

    describe('queries', () => {
      it('should filter out non existing fields', async () => {
        await account.getAll({
          address   : '1',
          publicKey : new Buffer('1'),
          isDelegate: 1,
          username  : 'user',
          brother   : 'thers a place to rediscovar'
        });

        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address   : '1',
          publicKey : new Buffer('1'),
          isDelegate: 1,
          username  : 'user',
        });
      });
      it('should uppercase address', async () => {
        await account.getAll({ address: 'hey' });
        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address: 'HEY',
        });
      });
      it('should uppercase addresses', async () => {
        await account.getAll({ address: { $in: ['hey', 'brother'] } });
        expect(findAllStub.firstCall.args[0].where.address[Op.in]).to.be.deep.eq([
          'HEY',
          'BROTHER',
        ]);
      });
      it('should filter out undefined filter fields', async () => {
        await account.getAll({ address: '1', publicKey: undefined });

        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address: '1',
        });
      });

      it('should honor limit param or use undefined', async () => {
        await account.getAll({ address: '1', limit: 10 });

        expect(findAllStub.firstCall.args[0].limit).to.be.deep.eq(10);

        await account.getAll({ address: '1' });
        expect(findAllStub.secondCall.args[0].limit).to.be.undefined;
      });
      it('should honor offset param or use undefined', async () => {
        await account.getAll({ address: '1', offset: 10 });

        expect(findAllStub.firstCall.args[0].offset).to.be.deep.eq(10);

        await account.getAll({ address: '1' });
        expect(findAllStub.secondCall.args[0].offset).to.be.undefined;
      });

      it('should allow string sort param', async () => {
        await account.getAll({ address: '1', sort: 'username' });
        expect(findAllStub.firstCall.args[0].order).to.be.deep.eq([['username', 'ASC']]);
      });

      it('should allow array sort param', async () => {
        await account.getAll({ address: '1', sort: { username: 1, address: -1 } });
        expect(findAllStub.firstCall.args[0].order).to.be.deep.eq([['username', 'ASC'], ['address', 'DESC']]);
      });

    });

  });

  describe('account.set', () => {
    let upsertStub: SinonStub;
    beforeEach(() => {
      upsertStub = sandbox.stub(accountsModel, 'upsert').resolves();
    });

    it('should call AccountsModel upsert with upperccasedAddress', async () => {
      await account.set('address', { balance: 10 });
      expect(upsertStub.firstCall.args[0]).to.be.deep.eq({
        address: 'ADDRESS',
        balance: 10
      });
    });
    it('should throw if publicKey is defined but invalid', async () => {
      await expect(account.set('address', { publicKey: new Buffer('a') })).to.be.rejected;
    });
  });

  describe('account.merge', () => {
    it('should throw if not valid publicKey', () => {
      expect(() => account.merge('1R', { publicKey: new Buffer(1) })).to.throw();
    });
    it('should return empty array if no ops to be performed', () => {
      const ops: any = account.merge('1R', {});
      expect(ops.length).to.be.eq(1);
      const updateOp = ops[0] as DBUpdateOp<any>;
      expect(updateOp.type).to.be.deep.eq('update');
      expect(updateOp.values).to.be.deep.eq({});
    });
    it('should allow only editable fields and discard the others', () => {
      const ops = account.merge('1R', {
        balance          : 11,
        u_balance        : 12,
        rate             : 13,
        virgin           : 14,
        rewards          : 15,
        fees             : 16,
        producedblocks   : 17,
        publicKey        : Buffer.alloc(32).fill('a'),
        secondSignature  : 19,
        u_secondSignature: 20,
        isDelegate       : 21,
        u_isDelegate     : 22,
        missedblocks     : 18,
        blockId          : '1',
        round            : 10,
        vote             : 10, username: 'meow', u_username: 'meow', address: '2R', secondPublicKey: new Buffer('aa'),
      } as any);
      expect(ops.length).to.be.eq(2);

      const updateOp = ops[1] as DBUpdateOp<any>;
      expect(updateOp.type).to.be.deep.eq('update');
      expect(updateOp.values).to.be.deep.eq({
        vote          : { val: 'vote + 10' },
        balance       : { val: 'balance + 11' },
        u_balance     : { val: 'u_balance + 12' },
        rate          : { val: 'rate + 13' },
        rewards       : { val: 'rewards + 15' },
        fees          : { val: 'fees + 16' },
        producedblocks: { val: 'producedblocks + 17' },
        missedblocks  : { val: 'missedblocks + 18' },
        blockId       : '1'
      });
    });
    it('should handle balance', () => {
      const ops: any = account.merge('1R', { balance: 10, blockId: '1', round: 1 });
      expect(ops[0].type).to.be.eq('custom');
      expect((ops[0] as DBCustomOp<any>).query).to.be.eq('INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT \'1R\', (10)::bigint, "dependentId", \'1\', 1 FROM mem_accounts2delegates WHERE "accountId" = \'1R\'');
      expect((ops[1] as DBUpdateOp<any>).values).to.be.deep.eq({ balance: { val: 'balance + 10' }, blockId: '1' })
    });
    it('should handle delegates', () => {
      const ops: any         = account.merge('1R', { delegates: ['+a', '-b', '-c'], blockId: '1', round: 1 })
      // expect(ops.length).eq(5);
      const removeDelegateOp = ops.filter((op) => op.type === 'remove')[0] as DBRemoveOp<any>;
      expect(removeDelegateOp.model).to.be.deep.eq(accounts2DelegatesModel);
      expect(removeDelegateOp.options.where).to.be.deep.eq({
        accountId  : '1R',
        dependentId: {}, // FIXME when sinon supports symbols comparison
      });
      expect(removeDelegateOp.options.where.dependentId[Op.in]).to.be.deep.eq(['b', 'c']);

      // a
      const createDelegateRowOp = ops.filter((op) => op.type === 'create')[0] as DBCreateOp<any>;
      expect(createDelegateRowOp.model).to.be.deep.eq(accounts2DelegatesModel);
      expect(createDelegateRowOp.values).to.be.deep.eq({ accountId: '1R', dependentId: 'a' });

      // Check delegates mem_rounds insertions/deletion for a and b,c
      const customRoundsOps = ops.filter((op) => op.type === 'custom' && op.model === roundsModel) as Array<DBCustomOp<any>>;
      expect(customRoundsOps.filter((op) => op.query.indexOf("'a'") !== -1)[0].query).to.contain('(balance)');
      expect(customRoundsOps.filter((op) => op.query.indexOf("'b'") !== -1)[0].query).to.contain('(-balance)');
      expect(customRoundsOps.filter((op) => op.query.indexOf("'c'") !== -1)[0].query).to.contain('(-balance)');
    });
    it('should handle multisignatures', () => {
      const ops: any = account.merge('1R', {
        multisignatures: ['+a', '-b', '+c'],
      });
      expect(ops.filter((op) => op.type === 'create')[0].values).to.be.deep.eq({ accountId: '1R', dependentId: 'a' });
      expect(ops.filter((op) => op.type === 'create')[1].values).to.be.deep.eq({ accountId: '1R', dependentId: 'c' });

      expect(ops.filter((op) => op.type === 'remove')[0].options.where.accountId).to.be.deep.eq('1R');
      expect(ops.filter((op) => op.type === 'remove')[0].options.where.dependentId[Op.in]).to.be.deep.eq(['b']);
    });
    it('should remove account virginity on u_balance', () => {
      const ops: any = account.merge('1R', { u_balance: -1 });
      expect(ops[0].values).to.be.deep.eq({
        u_balance: { val: 'u_balance - 1' },
        virgin   : 0,
      });
    });
  });

  describe('account.remove', () => {
    let destroyStub: SinonStub;
    beforeEach(() => {
      destroyStub = sandbox.stub(accountsModel, 'destroy').resolves();
    });
    it('should call accountsmodel.destroy with uppercase account', async () => {
      await account.remove('1r');
      expect(destroyStub.calledOnce).is.true;
      expect(destroyStub.firstCall.args[0]).is.deep.eq({
        where: {
          address: '1R',
        },
      });
    });

    it('should return whatever detroy returns', async () => {
      destroyStub.resolves(10);
      expect(await account.remove('1r')).to.be.eq(10);
    });
  });

  describe('generateAddressByPublicKey', () => {
    it('should return the address', () => {
      // tslint:disable max-line-length
      const address = account.generateAddressByPublicKey('29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da');
      expect(address).to.equal('2841811297332056155R');
    });
  });

});
