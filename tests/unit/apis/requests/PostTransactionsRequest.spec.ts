import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PostTransactionsRequest } from '../../../../src/apis/requests/PostTransactionsRequest';
import { Symbols } from '../../../../src/ioc/symbols';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable no-unused-expression
describe('apis/requests/PostTransactionsRequest', () => {
  let options;
  let instance: PostTransactionsRequest;
  let pbHelperStub: ProtoBufHelperStub;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    const container = createContainer();
    options = {data: {transactions: [ 'transaction1', 'transaction2' ]}};
    sandbox = sinon.createSandbox();
    instance = new PostTransactionsRequest();
    instance.options = options;
    pbHelperStub = container.get(Symbols.helpers.protoBuf);
    (instance as any).protoBufHelper = pbHelperStub;
    (instance as any).txModel = {toTransportTransaction: sandbox.stub().callsFake((a) => a)};
    (instance as any).generateBytesTransaction = sandbox.stub().callsFake((a) => a);
    pbHelperStub.enqueueResponse('encode', 'encodedValue');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRequestOptions', () => {
    describe('protoBuf = false', () => {
      it('should return request options as json', () => {
        const reqOpts = instance.getRequestOptions(false);
        expect(reqOpts).to.deep.equal({
          data: { transactions: [ 'transaction1', 'transaction2' ] },
          isProtoBuf: false,
          method: 'POST',
          url: '/peer/transactions',
        });
      });
    });
    describe('protoBuf = true', () => {
      it('should call protoBufHelper.validate', () => {
        pbHelperStub.stubs.validate.returns(true);
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.validate.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.validate.firstCall.args)
          .to.be.deep.equal([options.data, 'transportTransactions']);
      });

      it('should call protoBufHelper.encode if validate is true', () => {
        pbHelperStub.stubs.validate.returns(true);
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.encode.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.encode.firstCall.args)
          .to.be.deep.equal([options.data, 'transportTransactions']);
      });

      it('should return from protoBufHelper.encode into .data if validate is true', () => {
        pbHelperStub.stubs.validate.returns(true);
        const val = instance.getRequestOptions(true);
        expect(val.data).to.be.equal('encodedValue');
      });

      it('should throw if validate is false', () => {
        pbHelperStub.stubs.validate.returns(false);
        expect(() => { instance.getRequestOptions(true); }).to.throw('Failed to encode ProtoBuf');
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(false);
        expect(url).to.be.equal('/peer/transactions');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(true);
        expect(url).to.be.equal('/v2/peer/transactions');
      });
    });
  });
});
