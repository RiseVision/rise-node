import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { RequestLogger } from '../../../../src/apis/utils/requestLogger';
import { Symbols } from '../../../../src/ioc/symbols';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/attachPeerHeaders', () => {
  let sandbox: SinonSandbox;
  let instance: RequestLogger;
  let request: any;
  let response: any;
  let container: Container;

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.requestLogger).to(RequestLogger);
    sandbox = sinon.sandbox.create();
    response = {};
    request = {};
    instance = container.get(Symbols.api.utils.attachPeerHeaderToResponseObject);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('construct()', () => {
    it('should call fs.createWriteStream if enabled.');
    it('should not call fs.createWriteStream if not enabled.');
    it('should call logger.error if createWriteStream throws');
  });

  describe('use()', () => {
    it('should call process.hrtime with original hrtime');
    it('should call shouldLog');
    it('should call log if shouldLog returns true');
    it('should not call log if shouldLog returns true');
    it('should call next');
  });

  describe('shouldLog()', () => {
    it('should return false if not enabled');
    it('should return false if height is less than minHeight');
    it('should return false if request method is not post');
    it('should return false if URL is not one the accepted urls');
    it('should else return true');
  });

  describe('shouldLog()', () => {
    it('should call JSON.stringify');
    it('should call logStream.write');
    it('should generate log entries with the right format');
  });
});
