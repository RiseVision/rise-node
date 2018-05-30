import { ProtoBufHelper } from '../../../src/helpers/';
import { expect } from 'chai';
import { SinonSandbox, SinonStub } from 'sinon';

// tslint:disable no-unused-expression
describe('helpers/protobuf', () => {
  let instance: ProtoBufHelper;
  let sandbox: SinonSandbox;

  before(() => {
    instance = new ProtoBufHelper();
    const fakeLog = function(...args) {
      console.log(args);
    };
    (instance as any).logger = {error: fakeLog, debug:fakeLog};
  });

  afterEach(() => {
    // sandbox.restore();
  });

  describe('init', () => {
    it('teeest', async () => {
      instance.init();
      const payload = {id: 12345, message: 'ciaone', success: true};
      const buffer = instance.encode(payload, 'test', 'test2');
      const decoded = instance.decode(buffer as Buffer, 'test', 'test2');
      expect(JSON.stringify(decoded)).to.be.deep.equal(JSON.stringify(payload));
    });
  });
});
