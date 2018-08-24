import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { GetSignaturesRequest } from '../../../../src/apis/requests/GetSignaturesRequest';

// tslint:disable no-unused-expression
describe('apis/requests/GetSignaturesRequest', () => {
  let instance: GetSignaturesRequest;
  let decodeStub: SinonStub;
  let peer: any;

  beforeEach(() => {
    instance = new GetSignaturesRequest();
    instance.options = {data: null};
    decodeStub = sinon.stub(instance as any, 'decodeProtoBufResponse');
    peer = {
      broadhash: '123123123',
      clock: 9999999,
      height: 123,
      ip: '127.0.0.1',
      nonce: '1231234',
      os: 'unix',
      port: 5555,
      state: 2,
      updated: 123,
      version: '1.1.1',
    };
  });

  describe('getResponseData', () => {
    describe('protoBuf = false', () => {
      it('should return response body', () => {
        peer.version = '1.0.0';
        const body = instance.getResponseData({body: 'theBody', peer});
        expect(body).to.be.equal('theBody');
      });
    });
    describe('protoBuf = true', () => {
      it('should call decodeProtoBufResponse', () => {
        const res = {body: 'theBody', peer};
        instance.getResponseData(res);
        expect(decodeStub.calledOnce).to.be.true;
        expect(decodeStub.firstCall.args).to.be.deep.equal([res, 'transportSignatures', 'getSignaturesResponse']);
      });

      it('should return the decoded value', () => {
        decodeStub.returns('decodedValue');
        const decoded = instance.getResponseData({body: 'theBody', peer});
        expect(decoded).to.be.equal('decodedValue');
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(false);
        expect(url).to.be.equal('/peer/signatures');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(true);
        expect(url).to.be.equal('/v2/peer/signatures');
      });
    });
  });
});
