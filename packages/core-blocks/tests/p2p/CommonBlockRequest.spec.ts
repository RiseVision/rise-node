import { expect } from 'chai';
import {SinonStub} from 'sinon';
import * as sinon from 'sinon';
import { CommonBlockRequest } from '../../src/p2p';

describe('apis/requests/CommonBlockRequest', () => {
  let instance: CommonBlockRequest;

  beforeEach(() => {
    instance = new CommonBlockRequest();
    instance.options = {data: null, query: { ids: '1,2,3'}};
  });

  describe('getBaseUrl', () => {
    it('should return the right URL', () => {
      const url = (instance as any).getBaseUrl();
      expect(url).to.be.equal('/peer/blocks/common?ids=1%2C2%2C3');
    });
  });

  describe('getResponseData', () => {
    let decodeStub: SinonStub;
    let supportsStub: SinonStub;
    let fakeBlockLogic: any;
    let res: any;

    beforeEach(() => {
      fakeBlockLogic = {fromBytes: sinon.stub().returns('fromBytes')};
      decodeStub = sinon.stub((instance as any), 'decodeProtoBufResponse').returns({common: 'CommonBlockID'});
      supportsStub = sinon.stub((instance as any), 'peerSupportsProtoBuf').returns(true);
      (instance as any).blockLogic = fakeBlockLogic;
      res = {peer: 'peer', body: 'resBody'};
    });

    it('should call peerSupportsProtoBuf', () => {
      instance.getResponseData(res);
      expect(supportsStub.calledOnce).to.be.true;
      expect(supportsStub.firstCall.args).to.be.deep.equal([res.peer]);
    });

    describe('peerSupportsProtoBuf is true', () => {
      it('should call decodeProtoBufResponse with commonBlock message type', () => {
        instance.getResponseData(res);
        expect(decodeStub.calledOnce).to.be.true;
        expect(decodeStub.firstCall.args).to.be.deep.equal([res, 'transportBlocks', 'commonBlock']);
      });

      it('should call blockLogic.fromBytes if common is defined, and return it', () => {
        const ret = instance.getResponseData(res);
        expect(fakeBlockLogic.fromBytes.calledOnce).to.be.true;
        expect(fakeBlockLogic.fromBytes.firstCall.args).to.be.deep.equal(['CommonBlockID']);
        expect(ret).to.be.deep.equal({common: 'fromBytes'});
      });

      it('should set common to null if common is undefined, and return it', () => {
        decodeStub.returns( {});
        const ret = instance.getResponseData(res);
        expect(fakeBlockLogic.fromBytes.notCalled).to.be.true;
        expect(ret).to.be.deep.equal({common: null});
      });
    });

    describe('supportsProtobuf is false', () => {
      it('should return res.body', () => {
        supportsStub.returns( false);
        const ret = instance.getResponseData(res);
        expect(ret).to.be.deep.equal(res.body);
      });
    });
  });
});
