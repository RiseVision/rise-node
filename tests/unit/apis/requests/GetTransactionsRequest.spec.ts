import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { GetTransactionsRequest } from '../../../../src/apis/requests/GetTransactionsRequest';

describe('apis/requests/GetTransactionsRequest', () => {
  let instance: GetTransactionsRequest;
  let decodeStub: SinonStub;

  beforeEach(() => {
    instance = new GetTransactionsRequest();
    instance.options = {data: null};
    decodeStub = sinon.stub(instance as any, 'decodeProtoBufResponse');
  });

  describe('getResponseData', () => {
    describe('protoBuf = false', () => {
      it('should return response body', () => {
        const body = instance.getResponseData({body: 'theBody'});
        expect(body).to.be.equal('theBody');
      });
    });
    describe('protoBuf = true', () => {
      it('should call decodeProtoBufResponse', () => {
        const res = {body: 'theBody'}
        instance.getResponseData(res);
        expect(decodeStub.calledOnce).to.be.true;
        expect(decodeStub.firstCall.args).to.be.deep.equal([res, 'transportTransactions']);
      });

      it('should return the decoded value', () => {
        decodeStub.returns('decodedValue');
        const decoded = instance.getResponseData({body: 'theBody'});
        expect(decoded).to.be.equal('decodedValue');
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/peer/transactions');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/v2/peer/transactions');
      });
    });
  });
});