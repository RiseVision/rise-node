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
      it('should support being called with a single transaction', () => {
        instance.options = {data: {transaction: 'singleTX'}} as any;
        const reqOptions = instance.getRequestOptions(false);
        expect(reqOptions).to.be.deep.equal({
          isProtoBuf: false,
          method: 'POST',
          url: '/peer/transactions',
          data: {transaction: 'singleTX'},
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

      it('should support being called with a single transaction', () => {
        pbHelperStub.stubs.validate.returns(true);
        instance.options = {data: {transaction: 'singleTX'}} as any;
        const reqOptions = instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.validate.firstCall.args).to.be.deep.equal([
          {transaction: 'singleTX', },
          'transportTransactions',
        ]);
        expect(reqOptions).to.be.deep.equal({
          isProtoBuf: true,
          method: 'POST',
          url: '/v2/peer/transactions',
          data: 'encodedValue',
        });
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

  describe('isRequestExpired', () => {
    let txModule;
    beforeEach(() => {
      instance.options.data = {transactions: [{id: 1}, {id: 2}]} as any;
      txModule = { filterConfirmedIds: sandbox.stub().callsFake((ids: any[]) => ids) };
      (instance as any).txModule = txModule;
    });
    it('should return true if all txs in data are confirmed', async () => {
      txModule.filterConfirmedIds.returns([1, 2]);
      const res = await instance.isRequestExpired();
      expect(res).to.be.true;
    });
    it('should support being called with a single transaction', async () => {
      delete instance.options.data.transactions;
      instance.options.data.transaction =  {id: 3} as any;
      txModule.filterConfirmedIds.returns([3]);
      const res = await instance.isRequestExpired();
      expect(res).to.be.true;
    });
    it('should return false if no at least one tx is not confirmed yet', async () => {
      txModule.filterConfirmedIds.returns([1]);
      const res = await instance.isRequestExpired();
      expect(res).to.be.false;
    });
    it('should return false if no tx is confirmed yet', async () => {
      txModule.filterConfirmedIds.returns([]);
      const res = await instance.isRequestExpired();
      expect(res).to.be.false;
    });
  });

  // TODO: Move this test to APIRequest
  /*
  describe('generateBytesTransaction()', () => {
    beforeEach(() => {
      transactionLogicStub.stubs.getBytes.returns(Buffer.from('112233', 'hex'));
    });

    it('should call getBytes', () => {
      (instance as any).generateBytesTransaction('tx');
      expect(transactionLogicStub.stubs.getBytes.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.getBytes.firstCall.args).to.be.deep.equal(['tx']);
    });

    it('should include all fields', () => {
      const tx = {
        fee: 1,
        requesterPublicKey: 'ABC',
        signSignature: 'aaa',
      };
      const val = (instance as any).generateBytesTransaction(tx);
      expect(val).to.be.deep.equal({
        bytes: Buffer.from('112233', 'hex'),
        fee: 1,
        hasRequesterPublicKey: true,
        hasSignSignature: true,
      });
    });
  });
  */
});
