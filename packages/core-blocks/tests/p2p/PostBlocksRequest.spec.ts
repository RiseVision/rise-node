import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { p2pSymbols } from '../../src/helpers';
import { PostBlocksRequest } from '../../src/p2p';
import { ProtoBufHelperStub } from '../stubs/protobufhelperStub';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
// tslint:disable no-unused-expression
describe('apis/requests/PostBlockRequest', () => {
  let options;
  let instance: PostBlocksRequest;
  let pbHelperStub: ProtoBufHelperStub;
  let blocksModelStub: any;
  let sandbox: SinonSandbox;

  beforeEach(async () => {
    const container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
    options = {data: {block: 'b1'}};
    sandbox = sinon.createSandbox();
    instance = new PostBlocksRequest();
    instance.options = options;
    pbHelperStub = container.get(p2pSymbols.helpers.protoBuf);
    (instance as any).protoBufHelper = pbHelperStub;
    blocksModelStub = {toStringBlockType: sandbox.stub().callsFake((a) => a) };
    (instance as any).blocksModel = blocksModelStub;
    (instance as any).generateBytesBlock = sandbox.stub().callsFake((a) => a);
    pbHelperStub.stubs.validate.returns(true);
    pbHelperStub.stubs.encode.returns('encodedValue');
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

  // TODO: Move this test to APIRequest
  /*
  describe('generateBytesBlock()', () => {
    const block = {
      height: 112233,
      transactions: ['tx1', 'tx2'],
    };

    beforeEach(() => {
      blockLogicStub.stubs.getBytes.returns(Buffer.from('112233', 'hex'));
      generateBytesTransactionStub = sandbox.stub(instance as any, 'generateBytesTransaction')
        .returns(Buffer.from('0123', 'hex'));
    });

    it('should call getBytes', () => {
      (instance as any).generateBytesBlock(block);
      expect(blockLogicStub.stubs.getBytes.calledOnce).to.be.true;
      expect(blockLogicStub.stubs.getBytes.firstCall.args).to.be.deep.equal([block]);
    });

    it('should call generateBytesTransaction for each tx', () => {
      (instance as any).generateBytesBlock(block);
      expect(generateBytesTransactionStub.callCount).to.be.equal(block.transactions.length);
      expect(generateBytesTransactionStub.args).to.be.deep.equal(block.transactions.map((t) => [t]));
    });

    it('should included all fields', () => {
      const val = (instance as any).generateBytesBlock(block);
      expect(val).to.be.deep.equal({
        bytes       : Buffer.from('112233', 'hex'),
        height      : block.height,
        transactions: block.transactions.map(() => Buffer.from('0123', 'hex')),
      });
    });
  });
  */
});
