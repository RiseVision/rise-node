import { expect } from 'chai';
import * as jsonSqlCreator from 'json-sql';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { DbStub, LoggerStub, ZSchemaStub } from '../../stubs';

const RewireAccount = rewire('../../../src/logic/account');
const jsonSql       = jsonSqlCreator();
jsonSql.setDialect('postgresql');

const table = 'mem_accounts';

// tslint:disable no-unused-expression

/**
 * TODO: Better describe test cases
 * TODO: Check if more test cases are needed
 */
describe('logic/account', () => {
  const originalPgp = RewireAccount.__get__('pgp');
  let pgp;
  let account;
  let dbStub: DbStub;
  let loggerStub: LoggerStub;
  let zSchemaStub: ZSchemaStub;
  before(() => {
    dbStub                  = new DbStub();
  });

  beforeEach(() => {
    pgp = { QueryFile: () => { return; } };
    RewireAccount.__set__('pgp', pgp);
    loggerStub              = new LoggerStub();
    zSchemaStub             = new ZSchemaStub();
    account                 = new RewireAccount.AccountLogic();
    // Inject the dependencies
    (account as any).db     = dbStub;
    (account as any).logger = loggerStub;
    (account as any).schema = zSchemaStub;
    dbStub.reset();
  });

  afterEach(() => {
    RewireAccount.__set__('pgp', originalPgp);
  });

  describe('constructor', () => {
    it('binary should match', () => {
      const binary = ['publicKey', 'secondPublicKey'];
      expect(account.binary).to.deep.equal(binary);
    });

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
        { field: 'nameexist' },
        { field: 'u_nameexist' },
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
        username         : {
          case     : 'lower',
          maxLength: 20,
          minLength: 1,
          type     : 'string',
        },
        isDelegate       : { type: 'boolean' },
        u_isDelegate     : { type: 'boolean' },
        secondSignature  : { type: 'boolean' },
        u_secondSignature: { type: 'boolean' },
        u_username       : {
          case     : 'lower',
          maxLength: 20,
          minLength: 1,
          type     : 'string',
        },
        address          : {
          case     : 'upper',
          minLength: 1,
          maxLength: 22,
          required : true,
          type     : 'string',
        },
        publicKey        : { type: 'string', format: 'publicKey' },
        secondPublicKey  : { type: 'string', format: 'publicKey' },
        balance          : {
          maximum : 10999999991000000,
          minimum : 0,
          required: true,
          type    : 'integer',
        },
        u_balance        : {
          maximum : 10999999991000000,
          minimum : 0,
          required: true,
          type    : 'integer',
        },
        vote             : { type: 'integer' },
        rate             : { type: 'integer' },
        delegates        : { type: 'array', uniqueItems: true },
        u_delegates      : { type: 'array', uniqueItems: true },
        multisignatures  : { type: 'array', uniqueItems: true },
        u_multisignatures: { type: 'array', uniqueItems: true },
        multimin         : { type: 'integer', minimum: 0, maximum: 17 },
        u_multimin       : { type: 'integer', minimum: 0, maximum: 17 },
        multilifetime    : { type: 'integer', minimum: 1, maximum: 72 },
        u_multilifetime  : { type: 'integer', minimum: 1, maximum: 72 },
        blockId          : { type: 'string', minLength: 1, maxLength: 20 },
        nameexist        : { type: 'boolean' },
        u_nameexist      : { type: 'boolean' },
        producedblocks   : { type: 'integer', minimum: -1, maximum: 1 },
        missedblocks     : { type: 'integer', minimum: -1, maximum: 1 },
        fees             : { type: 'integer' },
        rewards          : { type: 'integer' },
        virgin           : { type: 'boolean' },
      };
      expect(account.filter).to.deep.equal(filter);
    });

    it('conv should match', () => {
      const conv = {
        username         : String,
        isDelegate       : Boolean,
        u_isDelegate     : Boolean,
        secondSignature  : Boolean,
        u_secondSignature: Boolean,
        u_username       : String,
        address          : String,
        publicKey        : String,
        secondPublicKey  : String,
        balance          : Number,
        u_balance        : Number,
        vote             : Number,
        rate             : Number,
        delegates        : Array,
        u_delegates      : Array,
        multisignatures  : Array,
        u_multisignatures: Array,
        multimin         : Number,
        u_multimin       : Number,
        multilifetime    : Number,
        u_multilifetime  : Number,
        blockId          : String,
        nameexist        : Boolean,
        u_nameexist      : Boolean,
        producedblocks   : Number,
        missedblocks     : Number,
        fees             : Number,
        rewards          : Number,
        virgin           : Boolean,
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
        'nameexist',
        'u_nameexist',
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

    beforeEach(() => {
      sinon.stub(pgp, 'QueryFile');
    });

    afterEach(() => {
      pgp.QueryFile.restore();
    });

    it('should handle sql error', async () => {
      const error = new Error('error');

      dbStub.enqueueResponse('query', Promise.reject(error));

      await account.createTables().then(() => {
        throw new Error('Expected method to reject.');
      }).catch((errorMessage) => {
        // It should call QueryFile
        expect(pgp.QueryFile.called).to.be.true;
        expect(pgp.QueryFile.getCall(0).args.length).to.equal(2);
        expect(pgp.QueryFile.getCall(0).args[0]).to.equal(sqlPath);
        expect(pgp.QueryFile.getCall(0).args[1]).to.deep.equal({ minify: true });
        // It should call db.query
        expect(dbStub.stubs.query.calledOnce).to.be.true;
        expect(dbStub.stubs.query.getCall(0).args.length).to.equal(1);
        expect(dbStub.stubs.query.getCall(0).args[0]).to.be.instanceof(pgp.QueryFile);
        // It should log the error
        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
        expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
          error.stack
        );
        expect(errorMessage).to.equal('Account#createTables error');
      });
    });

    it('should create tables', async () => {
      dbStub.enqueueResponse('query', Promise.resolve('OK'));

      await account.createTables();

      // It should call QueryFile with the right path
      expect(pgp.QueryFile.calledOnce).to.be.true;
      expect(pgp.QueryFile.getCall(0).args.length).to.equal(2);
      expect(pgp.QueryFile.getCall(0).args[0]).to.equal(sqlPath);
      expect(pgp.QueryFile.getCall(0).args[1]).to.deep.equal({ minify: true });
      // It should call db.query
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.getCall(0).args.length).to.equal(1);
      expect(dbStub.stubs.query.getCall(0).args[0]).to.be.instanceof(pgp.QueryFile);
    });
  });

  describe('account.removeTables', () => {
    const tables = [
      table,
      'mem_round',
      'mem_accounts2delegates',
      'mem_accounts2u_delegates',
      'mem_accounts2multisignatures',
      'mem_accounts2u_multisignatures',
    ];

    const sqles = tables.map((tbl) => {
      const sql = jsonSql.build({
        type : 'remove',
        table: tbl,
      });
      return sql.query;
    });

    it('should handle errors', async () => {
      const error = new Error('error');
      dbStub.enqueueResponse('query', Promise.reject(error));

      await account.removeTables().then(() => {
        throw new Error('Expected method to reject.');
      }).catch((errorMessage) => {
        // It should call db.query with the right query
        expect(dbStub.stubs.query.calledOnce).to.be.true;
        expect(dbStub.stubs.query.getCall(0).args.length).to.equal(1);
        expect(dbStub.stubs.query.getCall(0).args[0]).to.deep.equal(sqles.join(''));
        // It should log the error
        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
        expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
          error.stack
        );
        expect(errorMessage).to.equal('Account#removeTables error');
      });
    });

    it('should remove tables', async () => {
      dbStub.enqueueResponse('query', Promise.resolve('OK'));

      await account.removeTables();

      // It should call db.query with the right query
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.getCall(0).args.length).to.equal(1);
      expect(dbStub.stubs.query.getCall(0).args[0]).to.deep.equal(sqles.join(''));

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
      const publicKey         = '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da';
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

  describe('account.toDB', () => {
    it('should convert correctly', () => {
      const raw = {
        publicKey:
          '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da',
        address  : '2841811297332056155r',
      };

      const result = account.toDB(raw);

      expect(result.publicKey).to.deep.equal(new Buffer(raw.publicKey, 'hex'));
      expect(result.address).to.equal(raw.address.toUpperCase());
    });
  });

  describe('account.get', () => {
    const data   = ['some data'];
    const filter = {};

    beforeEach(() => {
      sinon.stub(account, 'getAll');
    });

    afterEach(() => {
      account.getAll.restore();
    });

    it('without fields; getAll error', async () => {
      const error  = 'error';
      const fields = account.fields.map((field) => field.alias || field.field);

      account.getAll.returns(Promise.reject(error));

      await account.get(filter).then(() => {
        throw new Error('Should reject');
      }).catch((err) => {
        expect(err).to.equal(error);
        expect(account.getAll.calledOnce).to.be.true;
        expect(account.getAll.getCall(0).args.length).to.equal(2);
        expect(account.getAll.getCall(0).args[0]).to.equal(filter);
        expect(account.getAll.getCall(0).args[1]).to.deep.equal(fields);
      });
    });

    it('with fields; getAll error', async () => {
      const error  = 'error';
      const fields = {};

      account.getAll.returns(Promise.reject(error));

      await account.get(filter, fields).then(() => {
        throw new Error('Should reject');
      }).catch((err) => {
        expect(err).to.equal(error);
        expect(account.getAll.calledOnce).to.be.true;
        expect(account.getAll.getCall(0).args.length).to.equal(2);
        expect(account.getAll.getCall(0).args[0]).to.equal(filter);
        expect(account.getAll.getCall(0).args[1]).to.equal(fields);
      });
    });

    it('without fields', async () => {
      const fields = account.fields.map((field) => field.alias || field.field);

      account.getAll.returns(Promise.resolve(data));

      const retVal = await account.get(filter).catch(() => {
        throw new Error('Should resolve');
      });

      expect(account.getAll.calledOnce).to.be.true;
      expect(account.getAll.getCall(0).args.length).to.equal(2);
      expect(account.getAll.getCall(0).args[0]).to.equal(filter);
      expect(account.getAll.getCall(0).args[1]).to.deep.equal(fields);
      expect(retVal).to.equal(data[0]);
    });

    it('with fields', async () => {
      const fields = {};

      account.getAll.returns(Promise.resolve(data));

      const retVal = await account.get(filter, fields).catch(() => {
        throw new Error('Should resolve');
      });

      expect(account.getAll.calledOnce).to.be.true;
      expect(account.getAll.getCall(0).args.length).to.equal(2);
      expect(account.getAll.getCall(0).args[0]).to.equal(filter);
      expect(account.getAll.getCall(0).args[1]).to.equal(fields);
      expect(retVal).to.equal(data[0]);
    });
  });

  describe('account.getAll', () => {
    let filter: any;
    let fields: any[];
    let sql: string;
    let shortSql: string;
    let rows: any[];

    beforeEach(() => {
      filter   = {
        limit  : 4,
        offset : 2,
        sort   : 'username',
        address: '2841811297332056155r',
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

    it('without fields; error', async () => {
      const error = new Error('error');

      dbStub.enqueueResponse('query', Promise.reject(error));

      await account.getAll(filter).then(() => {
        throw new Error('Should reject');
      }).catch(() => {
        expect(dbStub.stubs.query.calledOnce).to.be.true;
        expect(dbStub.stubs.query.getCall(0).args.length).to.equal(2);
        expect(dbStub.stubs.query.getCall(0).args[0]).to.equal(sql);
        expect(dbStub.stubs.query.getCall(0).args[1]).to.deep.equal({
          p1: '2841811297332056155r',
        });

        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
        expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
          error.stack
        );
      });
    });

    it('without fields; success', async () => {
      dbStub.enqueueResponse('query', Promise.resolve(rows));

      const retVal = await account.getAll(filter).catch( () => {
        throw new Error('Should rejects');
      });

      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.getCall(0).args.length).to.equal(2);
      expect(dbStub.stubs.query.getCall(0).args[0]).to.equal(sql);
      expect(dbStub.stubs.query.getCall(0).args[1]).to.deep.equal({
        p1: '2841811297332056155r',
      });
      expect(retVal).to.be.deep.equal(rows);
    });

    it('with fields; error', async () => {
      const error = new Error('error');

      dbStub.enqueueResponse('query', Promise.reject(error));

      await account.getAll(filter, fields).then(() => {
        throw new Error('Should reject');
      }).catch(() => {
        expect(dbStub.stubs.query.calledOnce).to.be.true;
        expect(dbStub.stubs.query.getCall(0).args.length).to.equal(2);
        expect(dbStub.stubs.query.getCall(0).args[0]).to.equal(shortSql);
        expect(dbStub.stubs.query.getCall(0).args[1]).to.deep.equal({
          p1: '2841811297332056155r',
        });

        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
        expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
          error.stack
        );
      });
    });

    it('with fields; success', async () => {
      dbStub.enqueueResponse('query', Promise.resolve(rows));

      const retVal = await account.getAll(filter, fields);

      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.getCall(0).args.length).to.equal(2);
      expect(dbStub.stubs.query.getCall(0).args[0]).to.equal(shortSql);
      expect(dbStub.stubs.query.getCall(0).args[1]).to.deep.equal({
        p1: '2841811297332056155r',
      });
      expect(retVal).to.be.deep.eq(rows);
    });
  });

  describe('account.set', () => {
    const address = '2841811297332056155r';
    const fields  = {};
    const sql     = 'insert into "mem_accounts" ("address") values (${p1}) on conflict ("address") do update set ' +
                    '"address" = ${p2};';
    const values  = { p1: '2841811297332056155R', p2: '2841811297332056155R' };
    let callback: SinonStub;

    beforeEach(() => {
      sinon.stub(account, 'assertPublicKey');
      callback = sinon.stub();
    });

    afterEach(() => {
      account.assertPublicKey.restore();
    });

    it('should handle errors', async () => {
      const error = new Error('error');

      account.assertPublicKey.returns(true);
      dbStub.enqueueResponse('none', Promise.reject(error));

      await account.set(address, fields)
        .then(() => {
          throw new Error('should have failed');
        }).catch((err) =>  {
          expect(err).to.be.deep.eq('Account#set error');
          expect(dbStub.stubs.none.calledOnce).to.be.true;
          expect(dbStub.stubs.none.getCall(0).args.length).to.equal(2);
          expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(sql);
          expect(dbStub.stubs.none.getCall(0).args[1]).to.deep.equal(values);
        });
    });

    it('should set data', async () => {
      account.assertPublicKey.returns(true);
      dbStub.enqueueResponse('none', Promise.resolve());

      await account.set(address, fields, callback);

      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.getCall(0).args.length).to.equal(2);
      expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(sql);
      expect(dbStub.stubs.none.getCall(0).args[1]).to.deep.equal(values);
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args[1]).to.not.exist;
    });
  });

  describe('account.merge', () => {
    let address: string;
    let diff: any;
    let queries: string;
    let queries2: string;
    let callback: SinonStub;

    beforeEach(() => {
      address = '2841811297332056155r';
      diff    = {
        publicKey      :
          '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da',
        blockId        : '11273313233467167051',
        round          : 2707,
        balance        : 300,
        u_balance      : -300,
        multisignatures: [
          {
            action     : '+',
            dependentId: '11995752116878847490R',
          },
          {
            action     : '-',
            dependentId: '11995752116878847490R',
          },
        ],
        delegates      : [
          [
            '+',
            '5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde',
          ],
          [
            '-',
            '5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde',
          ],
        ],
      };
      queries = 'delete from "mem_accounts2delegates" where "dependentId" in ' +
                '(5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde) and "accountId" ' +
                '= \'2841811297332056155R\';insert into "mem_accounts2delegates" ("accountId", "dependentId") ' +
                'values (\'2841811297332056155R\', 5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde);' +
                'delete from "mem_accounts2multisignatures" where "dependentId" = \'11995752116878847490R\';' +
                'insert into "mem_accounts2multisignatures" ("dependentId") values (\'11995752116878847490R\');' +
                'update "mem_accounts" set "balance" = "balance" + 300, "u_balance" = "u_balance" - 300, "virgin" ' +
                '= 0, "blockId" = \'11273313233467167051\' where "address" = \'2841811297332056155R\';' +
                'INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT ' +
                '\'2841811297332056155R\', (300)::bigint, "dependentId", \'11273313233467167051\', 2707 FROM ' +
                'mem_accounts2delegates WHERE "accountId" = \'2841811297332056155R\';INSERT INTO mem_round ' +
                '("address", "amount", "delegate", "blockId", "round") SELECT \'2841811297332056155R\', ' +
                '(balance)::bigint, array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'],' +
                ' \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';INSERT ' +
                'INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT ' +
                '\'2841811297332056155R\', (-balance)::bigint, ' +
                'array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'],' +
                ' \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';';
      queries2 = 'delete from "mem_accounts2delegates" where "dependentId" in ' +
                '(5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde) and "accountId" ' +
                '= \'2841811297332056155R\';insert into "mem_accounts2delegates" ("accountId", "dependentId") ' +
                'values (\'2841811297332056155R\', 5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde);' +
                'delete from "mem_accounts2multisignatures" where "dependentId" = \'11995752116878847490R\';' +
                'insert into "mem_accounts2multisignatures" ("dependentId") values (\'11995752116878847490R\');' +
                'update "mem_accounts" set "balance" = "balance" - 1, "u_balance" = "u_balance" - 300, "virgin" ' +
                '= 0, "blockId" = \'11273313233467167051\' where "address" = \'2841811297332056155R\';' +
                'INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT ' +
                '\'2841811297332056155R\', (-1)::bigint, "dependentId", \'11273313233467167051\', 2707 FROM ' +
                'mem_accounts2delegates WHERE "accountId" = \'2841811297332056155R\';INSERT INTO mem_round ' +
                '("address", "amount", "delegate", "blockId", "round") SELECT \'2841811297332056155R\', ' +
                '(balance)::bigint, array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'],' +
                ' \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';INSERT ' +
                'INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT ' +
                '\'2841811297332056155R\', (-balance)::bigint, ' +
                'array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'],' +
                ' \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';';

      sinon.stub(account, 'assertPublicKey');
      account.assertPublicKey.returns(true);
      callback = sinon.stub();
    });

    afterEach(() => {
      account.assertPublicKey.restore();
    });

    it('should throw if verify throws error', () => {
      account.assertPublicKey.throws('error');

      expect(account.merge.bind(account, address, diff, callback)).to.throw();
    });

    it('should handle no queries passed', async () => {
      sinon.stub(account, 'get');

      dbStub.enqueueResponse('query', Promise.resolve([]));

      await account.merge(address, {}, callback);

      expect(dbStub.stubs.none.called).to.be.false;

      expect(account.get.calledOnce).to.be.true;
      expect(account.get.getCall(0).args.length).to.equal(1);
      expect(account.get.getCall(0).args[0]).to.deep.equal({ address: address.toUpperCase() });

      account.get.restore();
    });

    it('should handle no callback passed', async () => {
      RewireAccount.__set__('pgp', originalPgp);

      const testQueries =  await account.merge(address, diff);

      expect(testQueries).to.equal(queries);
    });

    it('should call callback correctly on error', async () => {
      const error = new Error('error');
      RewireAccount.__set__('pgp', originalPgp);
      dbStub.enqueueResponse('none', Promise.reject(error));

      await account.merge(address, diff, callback)
        .then(() => {
          throw new Error('Should have failed');
        })
        .catch((err) => {
          expect(err).to.be.eq('Account#merge error');
          expect(dbStub.stubs.none.calledOnce).to.be.true;
          expect(dbStub.stubs.none.getCall(0).args.length).to.equal(1);
          expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(queries);
          expect(loggerStub.stubs.error.calledOnce).to.be.true;
          expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
          expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
            error.stack
          );

          expect(callback.calledOnce).to.be.true;
          expect(callback.getCall(0).args.length).to.equal(1);
          expect(callback.getCall(0).args[0]).to.equal('Account#merge error');
        });
    });

    it('Should callback on success', async () => {
      RewireAccount.__set__('pgp', originalPgp);
      dbStub.enqueueResponse('none', Promise.resolve());
      dbStub.enqueueResponse('query', Promise.resolve([]));

      await account.merge(address, diff, callback);

      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.getCall(0).args.length).to.equal(1);
      expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(queries);
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.be.null;
      expect(callback.getCall(0).args[1]).to.be.undefined;
    });

    it('should return callback with rejected promise if one of diff fields value is Infinity', async()=>{
      diff.balance = Number.POSITIVE_INFINITY;
      await account.merge(address, diff, callback)
        .catch((err) => {
          expect(err).to.be.equal('Encountered insane number: Infinity');
        });
    });

    it('If balance is negative', async () => {
      diff.balance = -1;
      RewireAccount.__set__('pgp', originalPgp);
      dbStub.enqueueResponse('none', Promise.resolve());
      dbStub.enqueueResponse('query', Promise.resolve([]));

      await account.merge(address, diff, callback);

      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.getCall(0).args.length).to.equal(1);
      expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(queries2);
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.be.null;
      expect(callback.getCall(0).args[1]).to.be.undefined;
    });
  });

  describe('account.remove', () => {
    const address = '2841811297332056155R';
    const queries = 'delete from "mem_accounts" where "address" = ${p1};';
    const values  = { p1: '2841811297332056155R' };

    it('handle promise rejection', async () => {
      const error = new Error('error');
      dbStub.enqueueResponse('none', Promise.reject(error));

      await account.remove(address).then(() => {
        throw new Error('Should reject');
      }).catch(() => {
        expect(dbStub.stubs.none.calledOnce).to.be.true;
        expect(dbStub.stubs.none.getCall(0).args.length).to.equal(2);
        expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(queries);
        expect(dbStub.stubs.none.getCall(0).args[1]).to.deep.equal(values);

        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.getCall(0).args.length).to.equal(1);
        expect(loggerStub.stubs.error.getCall(0).args[0]).to.equal(
          error.stack
        );
      });
    });

    it('handle promise fulfillment', async () => {
      dbStub.enqueueResponse('none', Promise.resolve());

      const addr = await account.remove(address).catch(() => {
        throw new Error('Should resolve');
      });

      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.getCall(0).args.length).to.equal(2);
      expect(dbStub.stubs.none.getCall(0).args[0]).to.equal(queries);
      expect(dbStub.stubs.none.getCall(0).args[1]).to.deep.equal(values);
      expect(addr).to.equal(address);
    });
  });

  describe('generateAddressByPublicKey', () => {
    it('success', () => {
      const address = account.generateAddressByPublicKey('29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da');
      expect(address).to.equal('2841811297332056155R');
    });
  });
});
