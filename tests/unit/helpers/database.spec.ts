import {BigNumber} from 'bignumber.js';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import {Container} from 'inversify';
import * as path from 'path';
import * as monitor from 'pg-monitor';
import * as pgPromise from 'pg-promise';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import {SinonSandbox} from 'sinon';
import MyBigNumb from '../../../src/helpers/bignum';
import {Migrator} from '../../../src/helpers/migrator';
import {Symbols} from '../../../src/ioc/symbols';
import { LoggerStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

const pgStub = () => () => true;
const migratorStub = {} as any;

const ProxyDatabase = proxyquire('../../../src/helpers/database', {
  './migrator': migratorStub,
  'pg-monitor': monitor,
  'pg-promise': pgStub,
});

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/database', () => {
  let sandbox: SinonSandbox;
  let migrator: any;
  let pgOptions: any;
  let pgp: any;
  let db: any;
  let dbOneStub: any;
  let dbQueryStub: any;
  let pathJoinSpy: any;
  let fsReadDirSyncStub: any;
  let fsStatSyncStub: any;
  let appConfig: any;
  let loggerStub: LoggerStub;
  let container: Container;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    container = createContainer();
    loggerStub = container.get(Symbols.helpers.logger);
    pgOptions = {pgNative: true, noLocking: true, noWarnings: true};
    pgp = pgPromise(pgOptions);
    appConfig = {logEvents: [], user: 'abc', password: '123'};
    db = pgp(appConfig);
    dbOneStub = sandbox.stub(db, 'one').resolves({to_regclass: true});
    dbQueryStub = sandbox.stub(db, 'query').resolves([{id: 24}]);
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
    fsStatSyncStub = sandbox
      .stub(fs, 'statSync')
      .returns({isFile: () => true});
    migrator = new Migrator(pgp, db);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkMigrations()', () => {
    it('should return true', async () => {
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

    it('should return a BigNumber', async () => {
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
    it('should return an array', async () => {
      const result = await migrator.readPendingMigrations(new BigNumber(100));
      expect(pathJoinSpy.callCount).to.equal(7);
      expect(pathJoinSpy.args[0][0]).to.equal(process.cwd());
      expect(pathJoinSpy.args[0][1]).to.equal('sql');
      expect(pathJoinSpy.args[0][2]).to.equal('migrations');
      expect(fsReadDirSyncStub.args[0][0]).to.equal(
        path.join(process.cwd(), 'sql', 'migrations')
      );
      expect(result.length).to.equal(2);
    });
  });

  describe('applyPendingMigrations()', () => {
    it('should return pending migrations and call to db.query() for every pending migration file', async () => {
      const pendingMigrations = await migrator.readPendingMigrations(
        new BigNumber(100)
      );
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
    it('should call to db.query() for every pending migration ', async () => {
      const pendingMigrations = await migrator.readPendingMigrations(
        new BigNumber(100)
      );
      await migrator.insertAppliedMigrations(pendingMigrations);
      expect(dbQueryStub.calledTwice).to.be.true;
      expect(dbQueryStub.args[0][0]).contains(
        'INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING'
      );
      expect(dbQueryStub.args[1][0]).contains(
        'INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING'
      );
    });

    it('If there are not migrations', async () => {
      await migrator.insertAppliedMigrations([]);
      expect(dbQueryStub.called).to.be.false;
    });
  });

  describe('applyRuntimeQueryFile()', () => {
    it('should call to db.query() once with a QueryFile instance', () => {
      migrator.applyRuntimeQueryFile();
      expect(dbQueryStub.calledOnce).to.be.true;
      expect(dbQueryStub.args[0][0]).to.be.an.instanceof(pgPromise.QueryFile);
    });
  });

  describe('connect()', () => {
    it('should call to all migrations methods in the same order', async () => {
      migratorStub.Migrator = function Fake() {
        return migrator;
      };
      const checkMigrationsSpy = sandbox.spy(migrator, 'checkMigrations');
      const getLastMigrationSpy = sandbox.spy(migrator, 'getLastMigration');
      const readPendingMigrationsSpy = sandbox.spy(
        migrator,
        'readPendingMigrations'
      );
      const applyPendingMigrationsSpy = sandbox.spy(
        migrator,
        'applyPendingMigrations'
      );
      const insertAppliedMigrationsSpy = sandbox.spy(
        migrator,
        'insertAppliedMigrations'
      );
      const applyRuntimeQueryFileSpy = sandbox.spy(
        migrator,
        'applyRuntimeQueryFile'
      );

      await ProxyDatabase.connect(appConfig as any, loggerStub);
      expect(checkMigrationsSpy.calledOnce).to.be.true;
      expect(checkMigrationsSpy.calledBefore(getLastMigrationSpy)).to.be.true;
      expect(getLastMigrationSpy.calledOnce).to.be.true;
      expect(getLastMigrationSpy.calledBefore(readPendingMigrationsSpy)).to.be.true;
      expect(readPendingMigrationsSpy.calledOnce).to.be.true;
      expect(readPendingMigrationsSpy.calledBefore(applyPendingMigrationsSpy)).to.be.true;
      expect(applyPendingMigrationsSpy.calledOnce).to.be.true;
      expect(applyPendingMigrationsSpy.calledBefore(insertAppliedMigrationsSpy)).to.be.true;
      expect(insertAppliedMigrationsSpy.calledOnce).to.be.true;
      expect(insertAppliedMigrationsSpy.calledBefore(applyRuntimeQueryFileSpy)).to.be.true;
      expect(applyRuntimeQueryFileSpy.calledOnce).to.be.true;
      monitor.detach();
    });

    it('should call to logger.log() and set info.display to false', async () => {
      migratorStub.Migrator = function Fake() {
        return migrator;
      };

      const info = {event: 'event', text: 'text', display: true};

      await ProxyDatabase.connect(appConfig as any, loggerStub);
      (monitor as any).log('msg', info);

      expect(loggerStub.stubs.log.calledOnce).to.be.true;
      expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(info.event);
      expect(loggerStub.stubs.log.firstCall.args[1]).to.be.equal(info.text);

      expect(info.display).to.be.false;
    });
  });
});
