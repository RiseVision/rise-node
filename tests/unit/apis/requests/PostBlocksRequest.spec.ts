import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BaseRequest } from '../../../../src/apis/requests/BaseRequest';
import { PostBlocksRequest } from '../../../../src/apis/requests/PostBlocksRequest';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

describe('apis/requests/PostBlocksRequest', () => {
  let options;
  let instance: PostBlocksRequest;
  let isPBStub: SinonStub;
  let pbHelperStub: ProtoBufHelperStub;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    createContainer(); // ensures protoBufHelper is injected into BaseRequest...
    options = {data: {blocks: ['b1', 'b2']}};
    sandbox = sinon.createSandbox();
    instance = new PostBlocksRequest(options);
    isPBStub = sandbox.stub(instance, 'isProtoBuf');
    pbHelperStub = BaseRequest.protoBufHelper as any;
    pbHelperStub.enqueueResponse('validate', true);
    pbHelperStub.enqueueResponse('encode', 'encodedValue');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRequestOptions', () => {
    describe('protoBuf = false', () => {
      it('should return request options as json', () => {
        isPBStub.returns(false);
        const reqOpts = JSON.stringify(instance.getRequestOptions());
        expect(reqOpts).to.be.equal(JSON.stringify({
          isProtoBuf: false,
          method: 'POST',
          url: '/peer/blocks',
          data: { blocks: [ 'b1', 'b2' ] } })
        );
      });
    });
    describe('protoBuf = true', () => {
      it('should call protoBufHelper.validate', () => {
        isPBStub.returns(true);
        instance.getRequestOptions();
        expect(pbHelperStub.stubs.validate.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.validate.firstCall.args)
          .to.be.deep.equal([options.data, 'transportBlocks', 'transportBlock']);
      });

      it('should call protoBufHelper.encode if validate is true', () => {
        isPBStub.returns(true);
        instance.getRequestOptions();
        expect(pbHelperStub.stubs.encode.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.encode.firstCall.args)
          .to.be.deep.equal([options.data, 'transportBlocks', 'transportBlock']);
      });

      it('should return from protoBufHelper.encode into .data if validate is true', () => {
        isPBStub.returns(true);
        const val = instance.getRequestOptions();
        expect(val.data).to.be.equal('encodedValue');
      });

      it('should throw if validate is false', () => {
        isPBStub.returns(true);
        pbHelperStub.stubs.validate.returns(false);
        expect(() => { instance.getRequestOptions(); }).to.throw('Failed to encode ProtoBuf');
      });
    });
  });

  describe('getBaseUrl', () => {
    describe('protoBuf = false', () => {
      it('should return the right URL', () => {
        isPBStub.returns(false);
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/peer/blocks');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        isPBStub.returns(true);
        const url = (instance as any).getBaseUrl();
        expect(url).to.be.equal('/v2/peer/blocks');
      });
    });
  });
});