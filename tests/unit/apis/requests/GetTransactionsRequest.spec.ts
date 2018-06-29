import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { GetTransactionsRequest } from '../../../../src/apis/requests/GetTransactionsRequest';

describe('apis/requests/GetTransactionsRequest', () => {
  let instance: GetTransactionsRequest;
  let isPBStub: SinonStub;
  let decodeStub: SinonStub;

  beforeEach(() => {
    instance = new GetTransactionsRequest({data: null});
    isPBStub = sinon.stub(instance, 'isProtoBuf');
    decodeStub = sinon.stub(instance as any, 'decodeProtoBufResponse');
  });

  describe('getResponseData', () => {
    describe('protoBuf = false', () => {
      it('should return response body', () => {
        isPBStub.returns(false);
        const body = instance.getResponseData({body: 'theBody'});
        expect(body).to.be.equal('theBody');
      });
    });
    describe('protoBuf = true', () => {
      it('should call decodeProtoBufResponse', () => {
        const res = {body: 'theBody'}
        isPBStub.returns(true);
        instance.getResponseData(res);
        expect(decodeStub.calledOnce).to.be.true;
        expect(decodeStub.firstCall.args).to.be.deep.equal([res, 'transportTransactions']);
      });

      it('should return the decoded value', () => {
        isPBStub.returns(true);
        decodeStub.returns('decodedValue');
        const decoded = instance.getResponseData({body: 'theBody'});
        expect(decoded).to.be.equal('decodedValue');
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        isPBStub.returns(false);
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/peer/transactions');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        isPBStub.returns(true);
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/v2/peer/transactions');
      });
    });
  });
});