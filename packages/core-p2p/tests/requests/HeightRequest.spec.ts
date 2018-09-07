import { expect } from 'chai';
import { HeightRequest } from '../../src/requests';
import { Container } from 'inversify';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { p2pSymbols, ProtoBufHelper } from '../../src/helpers';
import { RequestFactoryType } from '../../src/utils';

// tslint:disable no-unused-expression
describe('apis/requests/HeightRequest', () => {
  let instance: HeightRequest;
  // let decodeStub: SinonStub;
  let container: Container;
  let heightRequestFactory: RequestFactoryType<any, HeightRequest>;
  let protobufHelper: ProtoBufHelper;
  before(async () => {
    container          = await createContainer();
    heightRequestFactory = container.get(p2pSymbols.requests.height);
  });
  beforeEach(() => {
    protobufHelper = container.get<ProtoBufHelper>(p2pSymbols.helpers.protoBuf);
    instance = heightRequestFactory({ data: null });
  });

  describe('getResponseData', () => {
    it('should decode properly', () => {
      const buf = protobufHelper.encode({ height: 10 }, 'p2p.height', 'height');
      const resp = instance.getResponseData({body: buf, peer: null});
      expect(resp).deep.eq({ height: 10 });
    });
  });

});
