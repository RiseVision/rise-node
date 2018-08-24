import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { GetBlocksRequest } from '../../../../src/apis/requests/GetBlocksRequest';

// tslint:disable no-unused-expression
describe('apis/requests/GetBlocksRequest', () => {
  let instance: GetBlocksRequest;
  let decodeStub: SinonStub;
  let supportsPBStub: SinonStub;
  let peer;

  beforeEach(() => {
    instance = new GetBlocksRequest();
    instance.options = {data: null, query: {lastBlockId: '123456'}};
    (instance as any).blocksUtilsModule = {readDbRows: sinon.stub()};
    (instance as any).blockLogic = {fromBytes: sinon.stub()};
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
    supportsPBStub = sinon.stub(instance as any, 'peerSupportsProtoBuf');
  });

  describe('getResponseData', () => {
    describe('protoBuf = false', () => {
      it('should call readDbRows and return from it', () => {
        supportsPBStub.returns(false);
        (instance as any).blocksUtilsModule.readDbRows.callsFake((a) => a);
        const res = instance.getResponseData({body: {blocks : ['b1', 'b2']}, peer});
        expect((instance as any).blocksUtilsModule.readDbRows.calledOnce).to.be.true;
        expect((instance as any).blocksUtilsModule.readDbRows.firstCall.args[0])
          .to.be.deep.equal(['b1', 'b2']);
        expect(res).to.be.deep.equal({blocks : ['b1', 'b2']});
      });
    });

    describe('protoBuf = true', () => {
      beforeEach(() => {
        supportsPBStub.returns(true);
      });

      it('should call decodeProtoBufResponse', () => {
        const res = {body: 'theBody', peer};
        decodeStub.returns({blocks: ['b1', 'b2']});
        instance.getResponseData(res);
        expect(decodeStub.calledOnce).to.be.true;
        expect(decodeStub.firstCall.args).to.be.deep.equal([res, 'transportBlocks']);
      });

      it('should call blockLogic.fromBytes return the decoded value', () => {
        (instance as any).blockLogic.fromBytes.callsFake((a) => a);
        decodeStub.returns({blocks: ['b1', 'b2']});
        const decoded = instance.getResponseData({body: 'theBody'});
        expect(decoded).to.be.deep.equal({blocks: ['b1', 'b2']});
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(false);
        expect(url).to.be.equal('/peer/blocks?lastBlockId=123456');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(true);
        expect(url).to.be.equal('/v2/peer/blocks?lastBlockId=123456');
      });
    });
  });
});
