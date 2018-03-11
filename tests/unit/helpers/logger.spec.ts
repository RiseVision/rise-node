import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import loggerCreator from '../../../src/helpers/logger';
import { ILogger } from '../../../src/helpers/logger';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/logger', () => {
  let sandbox: SinonSandbox;
  let instance: ILogger;
  let fsStub: any;
  let logFileFake: any;
  let logFileWriteSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    logFileFake = { write: () => true };
    logFileWriteSpy = sandbox.spy(logFileFake, 'write');
    fsStub = sandbox.stub(fs, 'createWriteStream').returns(logFileFake);
    consoleLogSpy = sandbox.spy(console, 'log');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('none()', () => {
    it('success', () => {
      instance = loggerCreator({ echo: 'none', errorLevel: 'none' });
      instance.none('Message none', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('???');
      expect(logFileWriteSpy.args[0][0]).contains('Message none');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('???');
      expect(consoleLogSpy.args[0][3]).contains('Message none');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('trace()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'debug', errorLevel: 'debug' });
      instance.trace('Message trace', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'trace', errorLevel: 'trace' });
      instance.trace('Message trace', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('trc');
      expect(logFileWriteSpy.args[0][0]).contains('Message trace');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('trc');
      expect(consoleLogSpy.args[0][3]).contains('Message trace');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('debug()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'log', errorLevel: 'log' });
      instance.debug('Message debug', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'debug', errorLevel: 'debug' });
      instance.debug('Message debug', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('dbg');
      expect(logFileWriteSpy.args[0][0]).contains('Message debug');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('dbg');
      expect(consoleLogSpy.args[0][3]).contains('Message debug');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('log()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'info', errorLevel: 'info' });
      instance.log('Message log', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'log', errorLevel: 'log' });
      instance.log('Message log', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('log');
      expect(logFileWriteSpy.args[0][0]).contains('Message log');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('log');
      expect(consoleLogSpy.args[0][3]).contains('Message log');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('info()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'warn', errorLevel: 'warn' });
      instance.info('Message info', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'info', errorLevel: 'info' });
      instance.info('Message info', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('inf');
      expect(logFileWriteSpy.args[0][0]).contains('Message info');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('inf');
      expect(consoleLogSpy.args[0][3]).contains('Message info');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('warn()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'error', errorLevel: 'error' });
      instance.warn('Message warn', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'warn', errorLevel: 'warn' });
      instance.warn('Message warn', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('WRN');
      expect(logFileWriteSpy.args[0][0]).contains('Message warn');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('WRN');
      expect(consoleLogSpy.args[0][3]).contains('Message warn');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('error()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.error('Message error', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'error', errorLevel: 'error' });
      instance.error('Message error', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('ERR');
      expect(logFileWriteSpy.args[0][0]).contains('Message error');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('ERR');
      expect(consoleLogSpy.args[0][3]).contains('Message error');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('fatal()', () => {
    it('No log', () => {
      instance = loggerCreator({ echo: 'none', errorLevel: 'none' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('success', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('FTL');
      expect(consoleLogSpy.args[0][3]).contains('Message fatal');
      expect(consoleLogSpy.args[0][5]).to.deep.equal('{"foo":"bar"}');
    });
  });

  describe('setLevel()', () => {
    it('success', () => {
      instance = loggerCreator({ echo: 'none', errorLevel: 'none' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
      instance.setLevel('fatal');
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(consoleLogSpy.calledOnce).to.be.false;
    });
  });

  describe('snipsecret()', () => {
    it('success', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar', secret: '1234' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(logFileWriteSpy.args[0][0]).contains('"secret":"XXXXXXXXXX"');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0][0]).contains('FTL');
      expect(consoleLogSpy.args[0][3]).contains('Message fatal');
      expect(consoleLogSpy.args[0][5]).to.deep.equal(
        '{"foo":"bar","secret":"XXXXXXXXXX"}'
      );
    });
  });

  describe('Checking fs.createWriteStream() call', () => {
    it('Setting a filename', () => {
      instance = loggerCreator({
        echo: 'fatal',
        errorLevel: 'fatal',
        filename: 'my.log',
      });
      instance.fatal('Message fatal', { foo: 'bar', secret: '1234' });
      expect(fsStub.calledOnce).to.be.true;
      expect(fsStub.args[0][0]).to.equal('my.log');
    });

    it('Using default filename', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar', secret: '1234' });
      expect(fsStub.calledOnce).to.be.true;
      expect(fsStub.args[0][0]).contains('logs.log');
    });
  });
});
