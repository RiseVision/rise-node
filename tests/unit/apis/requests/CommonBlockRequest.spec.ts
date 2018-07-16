import { expect } from 'chai';
import { CommonBlockRequest } from '../../../../src/apis/requests/CommonBlockRequest';

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
});
