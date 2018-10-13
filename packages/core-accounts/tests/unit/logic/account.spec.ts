import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { AccountLogic } from '../../../src/';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { AccountsSymbols } from '../../../src';
import { IAccountsModel } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { DBUpdateOp } from '@risevision/core-types';
import { Op } from 'sequelize';

chai.use(chaiAsPromised);

const table = 'mem_accounts';

// tslint:disable no-unused-expression

describe('logic/account', () => {

  let sandbox: SinonSandbox;
  let instance: AccountLogic;
  let container: Container;
  let accModel: typeof IAccountsModel;
  before(async () => {
    container = await createContainer([
      'core-accounts',
      'core',
      'core-helpers',
    ]);
  });
  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    instance = container.get(AccountsSymbols.logic);
    accModel = container.getNamed(ModelSymbols.model, AccountsSymbols.model);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fields', () => {
    it('should correctly fill in editable fields', () => {
      expect(instance['editable']).deep.eq([
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
      ]);
    });
  });
  // describe('recreateTables', () => {
  //   let dropStub: SinonStub;
  //   let sequelizeStub: SinonStub;
  //   beforeEach(() => {
  //     dropStub = sandbox.stub(accModel, 'drop').resolves();
  //     sequelizeStub = sandbox.stub(accModel.sequelize, 'query').resolves();
  //
  //   });
  //   it('should drop and issue SQL query', async () => {
  //     await instance.recreateTables();
  //     expect(dropStub.called).is.true;
  //     expect(sequelizeStub.called).is.true;
  //     expect(sequelizeStub.calledWith(fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'memoryTables.sql'), { encoding: 'utf8' })))
  //   });
  //
  //   it('should be called using hookSystem', async () => {
  //     const stub = sinon.stub(instance, 'recreateTables').resolves();
  //     const hookSystem: WordPressHookSystem = container.get(Symbols.generic.hookSystem);
  //     await hookSystem.do_action('core/loader/load/recreateAccountsDatastores');
  //     expect(stub.called).true;
  //   });
  // });

  describe('account.assertPublicKey', () => {
    it('public key is not a string error', () => {
      const error = 'Invalid public key, must be a string';
      expect(() => instance.assertPublicKey(null)).to.throw(error);
    });

    it('public key is too short error', () => {
      const error = 'Invalid public key, must be 64 characters long';
      expect(() => instance.assertPublicKey('short string')).to.throw(error);
    });

    it('publicKey is undefined & allowUndefined is false', () => {
      const error = 'Public Key is undefined';
      expect(() => instance.assertPublicKey(undefined, false)).to.throw(error);
    });

    it('publicKey is 64byte long but not hex', () => {
      expect(() => instance.assertPublicKey(new Array(64).fill('g').join('')))
        .to.throw('Invalid public key, must be a hex string');
    });
  });
  //
  describe('account.get', () => {
    const filter = {};
    let getAllStub: SinonStub;
    beforeEach(() => {
      getAllStub = sandbox.stub(instance, 'getAll');
    });

    it('without fields; getAll error', async () => {
      const error = 'error';

      getAllStub.rejects(new Error(error));

      await expect(instance.get(filter)).to.be.rejectedWith('error');
      expect(getAllStub.calledOnce).is.true;
      expect(getAllStub.firstCall.args[0]).to.be.deep.eq(filter);
    });

    it('with fields; should propagate it', async () => {
      const error = 'error';
      getAllStub.rejects(new Error(error));
      await expect(instance.get(filter)).to.be.rejectedWith('error');
      expect(getAllStub.calledOnce).is.true;
      expect(getAllStub.firstCall.args[0]).to.be.deep.eq(filter);
    });

    it('should return first returned element from getAll', async () => {
      getAllStub.resolves(['1', '2']);
      const res = await instance.get(filter);
      expect(res).to.be.deep.eq('1');
    });
    it('should return undefined if no matching elements', async () => {
      getAllStub.resolves([]);
      const res = await instance.get(filter);
      expect(res).to.be.undefined;
    });
  });

  describe('account.getAll', () => {
    let filter: any;
    let fields: any[];
    let sql: string;
    let shortSql: string;
    let rows: any[];

    let findAllStub: SinonStub;
    beforeEach(() => {
      const scope = {
        findAll() {
          return void 0;
        },
      };
      findAllStub = sandbox.stub(accModel, 'findAll').resolves([]);
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

    describe('queries', () => {
      it('should filter out non existing fields', async () => {
        await instance.getAll({
          address   : '1',
          publicKey : new Buffer('1'),
          isDelegate: 1,
          username  : 'user',
          brother   : 'thers a place to rediscovar'
        } as any);

        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address   : '1',
          publicKey : new Buffer('1'),
          isDelegate: 1,
          username  : 'user',
        });
      });
      it('should uppercase address', async () => {
        await instance.getAll({ address: 'hey' });
        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address: 'HEY',
        });
      });
      it('should uppercase addresses', async () => {
        await instance.getAll({ address: { $in: ['hey', 'brother'] } });
        expect(findAllStub.firstCall.args[0].where.address[Op.in]).to.be.deep.eq([
          'HEY',
          'BROTHER',
        ]);
      });
      it('should filter out undefined filter fields', async () => {
        await instance.getAll({ address: '1', publicKey: undefined });

        expect(findAllStub.firstCall.args[0].where).to.be.deep.eq({
          address: '1',
        });
      });

      it('should honor limit param or use undefined', async () => {
        await instance.getAll({ address: '1', limit: 10 });

        expect(findAllStub.firstCall.args[0].limit).to.be.deep.eq(10);

        await instance.getAll({ address: '1' });
        expect(findAllStub.secondCall.args[0].limit).to.be.undefined;
      });
      it('should honor offset param or use undefined', async () => {
        await instance.getAll({ address: '1', offset: 10 });

        expect(findAllStub.firstCall.args[0].offset).to.be.deep.eq(10);

        await instance.getAll({ address: '1' });
        expect(findAllStub.secondCall.args[0].offset).to.be.undefined;
      });

      it('should allow string sort param', async () => {
        await instance.getAll({ address: '1', sort: 'username' });
        expect(findAllStub.firstCall.args[0].order).to.be.deep.eq([['username', 'ASC']]);
      });

      it('should allow array sort param', async () => {
        await instance.getAll({ address: '1', sort: { username: 1, address: -1 } });
        expect(findAllStub.firstCall.args[0].order).to.be.deep.eq([['username', 'ASC'], ['address', 'DESC']]);
      });

    });

  });
  //
  describe('account.set', () => {
    let upsertStub: SinonStub;
    beforeEach(() => {
      upsertStub = sandbox.stub(accModel, 'upsert').resolves();
    });

    it('should call AccountsModel upsert with upperccasedAddress', async () => {
      await instance.set('address', { balance: 10 });
      expect(upsertStub.firstCall.args[0]).to.be.deep.eq({
        address: 'ADDRESS',
        balance: 10
      });
    });
    it('should throw if publicKey is defined but invalid', async () => {
      await expect(instance.set('address', { publicKey: new Buffer('a') })).to.be.rejected;
    });
  });

  describe('account.merge', () => {
    it('should throw if not valid publicKey', () => {
      expect(() => instance.merge('1R', { publicKey: new Buffer(1) })).to.throw();
    });
    it('should return empty array if no ops to be performed', () => {
      const ops: any = instance.merge('1R', {});
      expect(ops.length).to.be.eq(1);
      const updateOp = ops[0] as DBUpdateOp<any>;
      expect(updateOp.type).to.be.deep.eq('update');
      expect(updateOp.values).to.be.deep.eq({});
    });
    it('should allow only editable fields and discard the others', () => {
      const ops = instance.merge('1R', {
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

      const updateOp = ops[0] as DBUpdateOp<any>;
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
      const ops: any = instance.merge('1R', { balance: 10, blockId: '1', round: 1 });
      expect((ops[0] as DBUpdateOp<any>).values).to.be.deep.eq({ balance: { val: 'balance + 10' }, blockId: '1' })
    });

    it('should remove account virginity on u_balance', () => {
      const ops: any = instance.merge('1R', { u_balance: -1 });
      expect(ops[0].values).to.be.deep.eq({
        u_balance: { val: 'u_balance - 1' },
        virgin   : 0,
      });
    });
  });
  //
  describe('account.remove', () => {
    let destroyStub: SinonStub;
    beforeEach(() => {
      destroyStub = sandbox.stub(accModel, 'destroy').resolves();
    });
    it('should call accountsmodel.destroy with uppercase account', async () => {
      await instance.remove('1r');
      expect(destroyStub.calledOnce).is.true;
      expect(destroyStub.firstCall.args[0]).is.deep.eq({
        where: {
          address: '1R',
        },
      });
    });

    it('should return whatever detroy returns', async () => {
      destroyStub.resolves(10);
      expect(await instance.remove('1r')).to.be.eq(10);
    });
  });

  describe('generateAddressByPublicKey', () => {
    it('should return the address', () => {
      // tslint:disable max-line-length
      const address = instance.generateAddressByPublicKey(Buffer.from('29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da', 'hex'));
      expect(address).to.equal('2841811297332056155R');
    });
  });

});
