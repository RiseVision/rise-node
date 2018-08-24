import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PostBlocksRequest } from '../../../../src/apis/requests/PostBlocksRequest';
import { Symbols } from '../../../../src/ioc/symbols';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable no-unused-expression
describe('apis/requests/PostBlocksRequest', () => {
  let options;
  let instance: PostBlocksRequest;
  let pbHelperStub: ProtoBufHelperStub;
  let blocksModelStub: any;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    const container = createContainer();
    options = {data: {block: 'b1'}};
    sandbox = sinon.createSandbox();
    instance = new PostBlocksRequest();
    instance.options = options;
    pbHelperStub = container.get(Symbols.helpers.protoBuf);
    (instance as any).protoBufHelper = pbHelperStub;
    blocksModelStub = {toStringBlockType: sandbox.stub().callsFake((a) => a) };
    (instance as any).blocksModel = blocksModelStub;
    (instance as any).generateBytesBlock = sandbox.stub().callsFake((a) => a);
    pbHelperStub.enqueueResponse('validate', true);
    pbHelperStub.enqueueResponse('encode', 'encodedValue');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRequestOptions', () => {
    describe('protoBuf = false', () => {
      it('should return request options as json', () => {
        const reqOpts = instance.getRequestOptions(false);
        expect(reqOpts).to.be.deep.equal({
          data: { block: 'b1' },
          isProtoBuf: false,
          method: 'POST',
          url: '/peer/blocks',
        });
      });
    });
    describe('protoBuf = true', () => {
      it('should call protoBufHelper.validate', () => {
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.validate.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.validate.firstCall.args)
          .to.be.deep.equal([options.data, 'transportBlocks', 'transportBlock']);
      });

      it('should call protoBufHelper.encode if validate is true', () => {
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.encode.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.encode.firstCall.args)
          .to.be.deep.equal([options.data, 'transportBlocks', 'transportBlock']);
      });

      it('should return from protoBufHelper.encode into .data if validate is true', () => {
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
        expect(url).to.be.equal('/peer/blocks');
      });
    });
    describe('protoBuf = true', () => {
      it('should return the right URL', () => {
        const url = (instance as any).getBaseUrl(true);
        expect(url).to.be.equal('/v2/peer/blocks');
      });
    });
  });
});
