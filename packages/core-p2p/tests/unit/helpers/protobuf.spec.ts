import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { LoggerStub } from '@risevision/core-utils/tests/unit/stubs';
import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { p2pSymbols, ProtoBufHelper } from '../../../src/helpers/';

// tslint:disable no-unused-expression no-big-function object-literal-sort-keys
describe('helpers/protobuf', () => {
  let instance: ProtoBufHelper;
  let instance2: ProtoBufHelper;
  let sandbox: SinonSandbox;
  let fakeLogger: LoggerStub;
  let container: Container;
  before(async () => {
    container = await createContainer([
      'core-helpers',
      'core-p2p',
      'core-crypto',
      'core-blocks',
      'core-transactions',
      'core',
      'core-accounts',
    ]);
    container.get(p2pSymbols.helpers.protoBuf);
    // allow non singletonness
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelper);
  });
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    instance = container.get(p2pSymbols.helpers.protoBuf);
    instance2 = container.get(p2pSymbols.helpers.protoBuf);
    instance.loadProto(`${__dirname}/test.proto`, 'test');
    instance2.loadProto(`${__dirname}/test.proto`, 'test');
    fakeLogger = container.get(Symbols.helpers.logger);
    fakeLogger.stubReset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('encode/decodeToObj', () => {
    it('encode -> decodeToObj should result to the same object', async () => {
      const payload = { id: 12345, message: 'theMessage!', success: true };
      const buffer = instance.encode(payload, 'test', 'test2');
      const decoded = instance.decodeToObj(
        buffer as Buffer,
        'test',
        'test2',
        {}
      );
      expect(decoded).to.be.deep.equal(payload);
    });
  });

  describe('validate', () => {
    it('should return false if message is not encodable', () => {
      expect(instance.validate({ test: 1 }, 'test')).false;
      expect(instance.validate({ longnumber: '1' }, 'test')).false;
      expect(instance.validate({ test: false }, 'test')).false;
      expect(instance.validate({ success: 0 }, 'test')).false;
    });
    it('should return true if message is encodable', () => {
      expect(instance.validate({}, 'test')).true;
      expect(instance.validate({ test: 'a' }, 'test')).true;
      expect(instance.validate({ success: true }, 'test')).true;
      expect(instance.validate({ success: false }, 'test')).true;
      expect(instance.validate({ longnumber: 10 }, 'test')).true;
    });
  });

  // tslint:disable max-line-length
  describe('encode/decode', () => {
    it('should return buffer', () => {
      const r = instance.encode({}, 'test');
      expect(r).instanceof(Buffer);
    });
    it('should return null if payload is invalid', () => {
      expect(instance.encode({ test: 1 }, 'test')).null;
    });
    it('should encode/decode properly', () => {
      const p = { test: 'hey brotha', success: true };

      const buf = instance.encode(p, 'test');
      const decoded = instance.decode(buf, 'test');
      expect(decoded.test).deep.eq(p.test);
      expect(decoded.success).deep.eq(p.success);
    });
    it('decode should fail if msg is indecifrable', () => {
      expect(() =>
        instance.decode(Buffer.from('hey', 'utf8'), 'test')
      ).to.throw('ProtoBuf Wire format invalid');
    });
  });

  describe('decodeToObj', () => {
    const p = { longnumber: 10000000, test: 'hey brotha', success: true };
    it('should honorate conv options', () => {
      const buf = instance.encode(p, 'test');

      expect(
        instance.decodeToObj(buf, 'test', 'test', { longs: Number })
      ).deep.eq(p);
    });
    it('should convert longs to string', () => {
      const buf = instance.encode(p, 'test');

      expect(
        instance.decodeToObj(buf, 'test', 'test', { longs: String })
      ).deep.eq({ ...p, longnumber: '10000000' });
    });
    it('should call postProcess over returning obj', () => {
      const buf = instance.encode(p, 'test');

      expect(
        instance.decodeToObj(buf, 'test', 'test', {
          longs: String,
          postProcess: (o) => ({ ...o, cat: 'meow' }),
        })
      ).deep.eq({ ...p, longnumber: '10000000', cat: 'meow' });
    });
  });
});
