import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { allBuffersToHex, ProtoBufHelper } from '../../../src/helpers/';

// tslint:disable no-unused-expression
describe('helpers/protobuf', () => {
  let instance: ProtoBufHelper;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    instance = new ProtoBufHelper();
    const fakeLog = function(...args) { return; };
    (instance as any).logger = {error: fakeLog, debug: fakeLog};
    instance.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('allBuffersToHex', () => {
    it('should convert all buffers to hex string', () => {
      const input = {
        bool: false,
        buf: Buffer.from('aabbcc', 'hex'),
        num: 12,
        s: 'str',
        sibling: {
          buf: Buffer.from('123456', 'hex'),
          sibling: {
            buf: Buffer.from('789012', 'hex'),
          },
        },
      };
      const output = {
        bool: false,
        buf: 'aabbcc',
        num: 12,
        s: 'str',
        sibling: {
          buf: '123456',
          sibling: {
            buf: '789012',
          },
        },
      };
      expect(allBuffersToHex(input)).to.be.deep.equal(output);
    });
  });
  describe('encode/decodeToObj', () => {
    it('encode -> decode should result to the same object', async () => {
      const payload = {id: 12345, message: 'theMessage!', success: true};
      const buffer = instance.encode(payload, 'test', 'test2');
      const decoded = instance.decodeToObj(buffer as Buffer, 'test', 'test2', {});
      expect(decoded).to.be.deep.equal(payload);
    });
  });

  // TODO add tests
  // describe('validate');
  // describe('encode');
  // describe('decode');
  // describe('decodeToObj');
});
