import { ILogger } from '@risevision/core-interfaces';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { loggerCreator } from '../src';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
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
    sandbox           = sinon.createSandbox();
    logFileFake       = {};
    logFileFake.write = () => true;
    logFileWriteSpy   = sandbox.spy(logFileFake, 'write');
    fsStub            = sandbox.stub(fs, 'createWriteStream').returns(logFileFake);
    consoleLogSpy     = sandbox.spy(console, 'log');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('none()', () => {
    it('should call to logFile() and console.log() if none() level is called', () => {
      instance = loggerCreator({ echo: 'none', errorLevel: 'none' });
      instance.none('Message none', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('???');
      expect(logFileWriteSpy.args[0][0]).contains('Message none');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('???');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message none');
      expect(consoleLogSpy.args[0].join(' ')).to.contain('{"foo":"bar"}');
    });
  });

  describe('trace()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'debug', errorLevel: 'debug' });
      instance.trace('Message trace', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'trace', errorLevel: 'trace' });
      instance.trace('Message trace', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('trc');
      expect(logFileWriteSpy.args[0][0]).contains('Message trace');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('trc');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message trace');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'trace', errorLevel: 'trace' });
      instance.debug('Message debug', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('dbg');
      expect(logFileWriteSpy.args[0][0]).contains('Message debug');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('dbg');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message debug');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('debug()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'log', errorLevel: 'log' });
      instance.debug('Message debug', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'debug', errorLevel: 'debug' });
      instance.debug('Message debug', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('dbg');
      expect(logFileWriteSpy.args[0][0]).contains('Message debug');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('dbg');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message debug');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'debug', errorLevel: 'debug' });
      instance.log('Message log', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('log');
      expect(logFileWriteSpy.args[0][0]).contains('Message log');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('log');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message log');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('log()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'info', errorLevel: 'info' });
      instance.log('Message log', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'log', errorLevel: 'log' });
      instance.log('Message log', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('log');
      expect(logFileWriteSpy.args[0][0]).contains('Message log');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('log');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message log');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'log', errorLevel: 'log' });
      instance.info('Message info', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('inf');
      expect(logFileWriteSpy.args[0][0]).contains('Message info');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('inf');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message info');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('info()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'warn', errorLevel: 'warn' });
      instance.info('Message info', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'info', errorLevel: 'info' });
      instance.info('Message info', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('inf');
      expect(logFileWriteSpy.args[0][0]).contains('Message info');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('inf');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message info');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'info', errorLevel: 'info' });
      instance.warn('Message warn', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('WRN');
      expect(logFileWriteSpy.args[0][0]).contains('Message warn');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('WRN');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message warn');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('warn()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'error', errorLevel: 'error' });
      instance.warn('Message warn', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'warn', errorLevel: 'warn' });
      instance.warn('Message warn', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('WRN');
      expect(logFileWriteSpy.args[0][0]).contains('Message warn');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('WRN');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message warn');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'warn', errorLevel: 'warn' });
      instance.error('Message error', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('ERR');
      expect(logFileWriteSpy.args[0][0]).contains('Message error');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('ERR');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message error');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('error()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.error('Message error', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'error', errorLevel: 'error' });
      instance.error('Message error', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('ERR');
      expect(logFileWriteSpy.args[0][0]).contains('Message error');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('ERR');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message error');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'error', errorLevel: 'error' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });
  });

  describe('fatal()', () => {
    it('should not log nothing if the called level is lower than the set level', () => {
      instance = loggerCreator({ echo: 'none', errorLevel: 'none' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.false;
      expect(consoleLogSpy.calledOnce).to.be.false;
    });

    it('should call to logFile() and console.log() if the set level and called level are equal', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('should call to logFile() and console.log() if the called level is greater than the set level', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.none('Message none', { foo: 'bar' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('???');
      expect(logFileWriteSpy.args[0][0]).contains('Message none');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('???');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message none');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"foo":"bar"}');
    });

    it('When data is an instance of Error', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', new Error('MyError'));
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(logFileWriteSpy.args[0][0]).contains('{"message":"MyError","error":"Error: MyError');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"message":"MyError","error":"Error: MyError');
    });

    it('Receiving an object with toLogObj() function', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar', toLogObj: () => ({ abc: 123 }) });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(logFileWriteSpy.args[0][0]).contains('{"abc":123}');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains('{"abc":123}');
    });

    it('If data is not an object', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', 'Not an object');
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(logFileWriteSpy.args[0][0]).contains('Not an object');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains('Not an object');
    });

    it('If data is empty', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal');
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
    });
  });

  describe('setLevel()', () => {
    it('should change the level after call to setLevel()', () => {
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
    it('should hide the secret property', () => {
      instance = loggerCreator({ echo: 'fatal', errorLevel: 'fatal' });
      instance.fatal('Message fatal', { foo: 'bar', secret: '1234' });
      expect(logFileWriteSpy.calledOnce).to.be.true;
      expect(logFileWriteSpy.args[0][0]).contains('FTL');
      expect(logFileWriteSpy.args[0][0]).contains('Message fatal');
      expect(logFileWriteSpy.args[0][0]).contains('"secret":"XXXXXXXXXX"');
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.args[0].join(' ')).contains('FTL');
      expect(consoleLogSpy.args[0].join(' ')).contains('Message fatal');
      expect(consoleLogSpy.args[0].join(' ')).contains(
        '{"foo":"bar","secret":"XXXXXXXXXX"}'
      );
    });
  });

  describe('Checking fs.createWriteStream() call', () => {
    it('Setting a filename', () => {
      instance = loggerCreator({
        echo      : 'fatal',
        errorLevel: 'fatal',
        filename  : 'my.log',
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
