import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PostSignaturesRequest } from '../../src/requests/PostSignaturesRequest';
import { ProtoBufHelperStub } from '../../../core-p2p/tests/stubs/protobufhelperStub';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';

// tslint:disable no-unused-expression
describe('apis/requests/PostSignaturesRequest', () => {
  let options;
  let instance: PostSignaturesRequest;
  let pbHelperStub: ProtoBufHelperStub;
  let sandbox: SinonSandbox;

  beforeEach(async () => {
    const container = await createContainer(['core-multisignature', 'core', 'core-helpers']);
    options = {data: {signatures: [{
      signature: 'aabbccddeeeff',
      transaction: '12345678901234567890',
    }]}};
    sandbox = sinon.createSandbox();
    instance = new PostSignaturesRequest();
    instance.options = options;
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
    pbHelperStub = container.get(p2pSymbols.helpers.protoBuf);
    (instance as any).protoBufHelper = pbHelperStub;
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
        expect(reqOpts).to.deep.equal({
          data      : {
            signatures: [{
              signature  : 'aabbccddeeeff',
              transaction: '12345678901234567890',
            }],
          },
          isProtoBuf: false,
          method    : 'POST',
          url       : '/peer/signatures',
        });
      });
    });

    describe('protoBuf = true', () => {
      it('should call protoBufHelper.validate', () => {
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.validate.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.validate.firstCall.args)
          .to.be.deep.equal([options.data, 'transportSignatures', 'postSignatures']);
      });

      it('should call protoBufHelper.encode if validate is true', () => {
        instance.getRequestOptions(true);
        expect(pbHelperStub.stubs.encode.calledOnce)
          .to.be.true;
        expect(pbHelperStub.stubs.encode.firstCall.args)
          .to.be.deep.equal([options.data, 'transportSignatures', 'postSignatures']);
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
