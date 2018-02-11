import { BigNumber } from 'bignumber.js';
import MyBigNumb from '../../../src/helpers/bignum';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as path from 'path';
import * as pgPromise from 'pg-promise';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { connect, Migrator } from '../../../src/helpers/database';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/database', () => {
  let sandbox: SinonSandbox;
  let migrator: Migrator;
  let pgOptions: any;
  let pgp: any;
  let db: any;
  let dbOneStub: any;
  let dbQueryStub: any;
  let pathJoinSpy: any;
  let fsReadDirSyncStub: any;
  let fsStatSyncStub: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    pgOptions = { pgNative: true };
    pgp = pgPromise(pgOptions);
    db = { one: () => true, query: () => true };
    dbOneStub = sandbox.stub(db, 'one').resolves({ to_regclass: true });
    dbQueryStub = sandbox.stub(db, 'query').resolves([{ id: 24 }]);
    pathJoinSpy = sandbox.spy(path, 'join');
    fsReadDirSyncStub = sandbox
      .stub(fs, 'readdirSync')
      .returns([
        'fooFolder',
        '100_aaa.sql',
        '101_bbb.sql',
        '102_bbb.sql',
        '103_ccc.txt',
        'fake.sql',
      ]);
    fsStatSyncStub = sandbox.stub(fs, 'statSync').returns({isFile: (fullpath: string) => true});
    migrator = new Migrator(pgp, db as any);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('checkMigrations()', () => {
    it('success', async () => {
      const result = await migrator.checkMigrations();
      expect(dbOneStub.calledOnce).to.be.true;
      expect(dbOneStub.args[0][0]).contains("SELECT to_regclass('migrations')");
      expect(result).to.be.true;
    });
  });

  describe('getLastMigration()', () => {
    it('hasMigration === false', async () => {
      const result = await migrator.getLastMigration(false);
      expect(result).to.be.undefined;
    });

    it('success', async () => {
      const result = await migrator.getLastMigration(true);
      expect(dbQueryStub.calledOnce).to.be.true;
      expect(dbQueryStub.args[0][0]).contains(
        'SELECT * FROM migrations ORDER BY "id" DESC LIMIT 1'
      );
      expect(result).to.be.an.instanceof(MyBigNumb);
      expect(result.toString()).to.equal('24');
    });
  });

  describe('readPendingMigrations()', () => {
    it('success', async () => {
      const result = await migrator.readPendingMigrations(new BigNumber(100));
      expect(pathJoinSpy.callCount).to.equal(7);
      expect(pathJoinSpy.args[0][0]).to.equal(process.cwd());
      expect(pathJoinSpy.args[0][1]).to.equal('sql');
      expect(pathJoinSpy.args[0][2]).to.equal('migrations');
      expect(fsReadDirSyncStub.args[0][0]).to.equal(path.join(process.cwd(), 'sql', 'migrations'));
      expect(result.length).to.equal(2);
    });
  });

  describe('applyPendingMigrations()', () => {
    it('success', async () => {
      const pendingMigrations = await migrator.readPendingMigrations(new BigNumber(100));
      const result = await migrator.applyPendingMigrations(pendingMigrations);
      expect(dbQueryStub.calledTwice).to.be.true;
      expect(dbQueryStub.args[0][0]).to.be.an.instanceof(pgPromise.QueryFile);
      expect(dbQueryStub.args[1][0]).to.be.an.instanceof(pgPromise.QueryFile);
      expect(result).to.deep.equal(pendingMigrations);
    });

    it('If there are not pending migrations', async () => {
      const result = await migrator.applyPendingMigrations([]);
      expect(dbQueryStub.called).to.be.false;
      expect(result).to.deep.equal([]);
    });
  });

  describe('insertAppliedMigrations()', () => {
    it('success', async () => {
      const pendingMigrations = await migrator.readPendingMigrations(new BigNumber(100));
      await migrator.insertAppliedMigrations(pendingMigrations);
      expect(dbQueryStub.calledTwice).to.be.true;
      expect(dbQueryStub.args[0][0]).contains('INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING');
      expect(dbQueryStub.args[1][0]).contains('INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING');
    });

    it('If there are not migrations', async () => {
      await migrator.insertAppliedMigrations([]);
      expect(dbQueryStub.called).to.be.false;
    });
  });

  describe('applyRuntimeQueryFile()', () => {
    it('success', () => {
      migrator.applyRuntimeQueryFile();
      expect(dbQueryStub.calledOnce).to.be.true;
      expect(dbQueryStub.args[0][0]).to.be.an.instanceof(pgPromise.QueryFile);
    });
  });
});
