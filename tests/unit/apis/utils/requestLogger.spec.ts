import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { RequestLogger } from '../../../../src/apis/utils/requestLogger';
import { IBlocksModule } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { AppConfig } from '../../../../src/types/genericTypes';
import { LoggerStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('apis/utils/requestLogger', () => {
  let sandbox: SinonSandbox;
  let instance: RequestLogger;
  let request: any;
  let response: any;
  let container: Container;
  let loggerStub: LoggerStub;
  const fakeRequest = {
    body: 'body',
    headers: 'headers',
    method: 'POST',
    query: 'query',
    url: 'url',
  };

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.requestLogger).to(RequestLogger);
    loggerStub = container.get(Symbols.helpers.logger);
    sandbox = sinon.sandbox.create();
    response = {};
    request = {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('construct()', () => {
    it('should call fs.createWriteStream if enabled.', () => {
      const createWriteStreamSpy = sandbox.spy(fs, 'createWriteStream');
      const appConfig: AppConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = true;
      instance = container.get(Symbols.api.utils.requestLogger);
      expect(createWriteStreamSpy.calledOnce).to.be.true;
      expect(createWriteStreamSpy.firstCall.args.length).to.be.equal(2);
      expect(createWriteStreamSpy.firstCall.args[1]).to.be.deep.equal({flags: 'a'});
    });

    it('should not call fs.createWriteStream if not enabled.', () => {
      const createWriteStreamSpy = sandbox.spy(fs, 'createWriteStream');
      const appConfig: AppConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = false;
      instance = container.get(Symbols.api.utils.requestLogger);
      expect(createWriteStreamSpy.notCalled).to.be.true;
    });

    it('should call logger.error if createWriteStream throws', () => {
      const er = new Error('test');
      sandbox.stub(fs, 'createWriteStream').throws(er);
      const appConfig: AppConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = true;
      instance = container.get(Symbols.api.utils.requestLogger);
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('requestLogger: error creating write stream');
      expect(loggerStub.stubs.error.firstCall.args[1]).to.be.deep.equal(er.stack);
    });
  });

  describe('use()', () => {
    let next: SinonStub;
    let logStub;
    beforeEach(() => {
      const appConfig: AppConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = true;
      instance = container.get(Symbols.api.utils.requestLogger);
      next = sandbox.stub();
      logStub = sandbox.stub(instance as any, 'log');
    });

    it('should call process.hrtime with original hrtime', () => {
      const hrtimeSpy = sandbox.spy(process, 'hrtime');
      instance.use(fakeRequest as any, {} as any, next);
      expect(hrtimeSpy.calledOnce).to.be.true;
      expect(hrtimeSpy.firstCall.args.length).to.be.equal(1);
      expect(Array.isArray(hrtimeSpy.firstCall.args[0])).to.be.true;
      expect(hrtimeSpy.firstCall.args[0].length).to.be.equal(2);
    });

    it('should call shouldLog', () => {
      const shouldLogSpy = sandbox.spy(instance as any, 'shouldLog');
      instance.use(fakeRequest as any, {} as any, next);
      expect(shouldLogSpy.calledOnce).to.be.true;
      expect(shouldLogSpy.firstCall.args.length).to.be.equal(1);
      expect(shouldLogSpy.firstCall.args[0]).to.be.deep.equal(fakeRequest);
    });

    it('should call log if shouldLog returns true', () => {
      sandbox.stub(instance as any, 'shouldLog').returns(true);
      instance.use(fakeRequest as any, {} as any, next);
      expect(logStub.calledOnce).to.be.true;
      expect(logStub.firstCall.args.length).to.be.equal(2);
      expect(logStub.firstCall.args[0]).to.be.deep.equal(fakeRequest);
      expect(Array.isArray(logStub.firstCall.args[1])).to.be.true;
      expect(logStub.firstCall.args[1].length).to.be.equal(2);
    });

    it('should not call log if shouldLog returns false', () => {
      sandbox.stub(instance as any, 'shouldLog').returns(false);
      instance.use(fakeRequest as any, {} as any, next);
      expect(logStub.notCalled).to.be.true;
    });

    it('should call next', () => {
      sandbox.stub(instance as any, 'shouldLog').returns(true);
      instance.use(fakeRequest as any, {} as any, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe('shouldLog()', () => {
    let appConfig: AppConfig;
    let blocksModule: IBlocksModule;

    beforeEach(() => {
      appConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = true;
      blocksModule = container.get(Symbols.modules.blocks);
    });

    it('should return false if not enabled', () => {
      appConfig.requestLogger.enabled = false;
      instance = container.get(Symbols.api.utils.requestLogger);
      const res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.false;
    });

    it('should return false if height is less than minHeight', () => {
      appConfig.requestLogger.enabled = true;
      blocksModule.lastBlock = {height: 10000} as any;
      appConfig.requestLogger.minHeight = 100;
      instance = container.get(Symbols.api.utils.requestLogger);
      const res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.false;
    });

    it('should return false if request method is not post', () => {
      appConfig.requestLogger.enabled = true;
      blocksModule.lastBlock = {height: 100} as any;
      appConfig.requestLogger.minHeight = 0;
      fakeRequest.method = 'get';
      instance = container.get(Symbols.api.utils.requestLogger);
      const res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.false;
    });

    it('should return false if URL is not one the accepted urls', () => {
      appConfig.requestLogger.enabled = true;
      blocksModule.lastBlock = {height: 100} as any;
      appConfig.requestLogger.minHeight = 0;
      fakeRequest.method = 'post';
      fakeRequest.url = '/another/url';
      instance = container.get(Symbols.api.utils.requestLogger);
      const res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.false;
    });

    it('should return true if all conditions are met, for any of the accepted urls', () => {
      appConfig.requestLogger.enabled = true;
      blocksModule.lastBlock = {height: 100} as any;
      appConfig.requestLogger.minHeight = 0;
      fakeRequest.method = 'post';
      fakeRequest.url = '/peer/signatures';
      instance = container.get(Symbols.api.utils.requestLogger);
      let res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.true;
      fakeRequest.url = '/peer/transactions';
      instance = container.get(Symbols.api.utils.requestLogger);
      res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.true;
      fakeRequest.url = '/peer/blocks';
      instance = container.get(Symbols.api.utils.requestLogger);
      res = (instance as any).shouldLog(fakeRequest);
      expect(res).to.be.true;
    });
  });

  describe('log()', () => {
    let appConfig: AppConfig;
    let blocksModule: IBlocksModule;
    let elapsed: [number, number];

    beforeEach(() => {
      appConfig = container.get(Symbols.generic.appConfig);
      appConfig.requestLogger.enabled = true;
      blocksModule = container.get(Symbols.modules.blocks);
      appConfig.requestLogger.enabled = true;
      blocksModule.lastBlock = {height: 100} as any;
      appConfig.requestLogger.minHeight = 0;
      fakeRequest.method = 'post';
      fakeRequest.url = '/peer/signatures';
      instance = container.get(Symbols.api.utils.requestLogger);
      elapsed = [10, 100];
    });

    it('should call JSON.stringify', () => {
      const stringifySpy = sandbox.spy(JSON, 'stringify');
      (instance as any).log(fakeRequest, elapsed);
      expect(stringifySpy.calledOnce).to.be.true;
      expect(stringifySpy.firstCall.args.length).to.be.equal(1);
      const json = stringifySpy.firstCall.args[0];
      expect(json.now).to.be.lte(Date.now());
      json.now = 0;
      expect(json).to.be.deep.equal({
        fromStart: elapsed,
        height: (instance as any).lastBlockHeight,
        now: 0,
        req: {
          body: fakeRequest.body,
          headers: fakeRequest.headers,
          query: fakeRequest.query,
          url: fakeRequest.url,
        },
      });
    });

    it('should call logStream.write and separate entries with a newline', () => {
      const writeSpy = sandbox.spy((instance as any).logStream, 'write');
      (instance as any).log(fakeRequest, elapsed);
      expect(writeSpy.calledOnce).to.be.true;
      expect(writeSpy.firstCall.args.length).to.be.equal(1);
      const str = writeSpy.firstCall.args[0];
      expect(str.substr(-1)).to.be.equal('\n');
    });
  });
});
