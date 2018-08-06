import { expect } from 'chai';
import * as Long from 'long';
import { util } from 'protobufjs';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { allBuffersToHex, ProtoBufHelper } from '../../../src/helpers/';
import ProtocolError = util.ProtocolError;

// tslint:disable no-unused-expression no-big-function object-literal-sort-keys
describe('helpers/protobuf', () => {
  let instance: ProtoBufHelper;
  let instance2: ProtoBufHelper;
  let sandbox: SinonSandbox;
  let fakeLogger: any;

  beforeEach(() => {
    sandbox                   = sinon.createSandbox();
    instance                  = new ProtoBufHelper();
    instance2                 = new ProtoBufHelper();
    fakeLogger                = { error: sandbox.stub(), debug: sandbox.stub() };
    (instance as any).logger  = fakeLogger;
    (instance2 as any).logger = fakeLogger;
    instance.init();
    instance2.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('allBuffersToHex', () => {
    it('should convert all buffers to hex string', () => {
      const input  = {
        bool   : false,
        buf    : Buffer.from('aabbcc', 'hex'),
        num    : 12,
        s      : 'str',
        sibling: {
          buf    : Buffer.from('123456', 'hex'),
          sibling: {
            buf: Buffer.from('789012', 'hex'),
          },
        },
      };
      const output = {
        bool   : false,
        buf    : 'aabbcc',
        num    : 12,
        s      : 'str',
        sibling: {
          buf    : '123456',
          sibling: {
            buf: '789012',
          },
        },
      };
      expect(allBuffersToHex(input)).to.be.deep.equal(output);
    });
  });

  describe('encode/decodeToObj', () => {
    it('encode -> decodeToObj should result to the same object', async () => {
      const payload = { id: 12345, message: 'theMessage!', success: true };
      const buffer  = instance.encode(payload, 'test', 'test2');
      const decoded = instance.decodeToObj(buffer as Buffer, 'test', 'test2', {});
      expect(decoded).to.be.deep.equal(payload);
    });
  });

  describe('validate', () => {
    let payload: any;
    let getMsgInstSpy: SinonSpy;

    beforeEach(() => {
      payload = { success: true, message: 'Success' };
    });

    it('should call getMessageInstance', () => {
      getMsgInstSpy = sandbox.spy(instance as any, 'getMessageInstance');
      instance.validate(payload, 'APISuccess');
      expect(getMsgInstSpy.calledOnce).to.be.true;
      expect(getMsgInstSpy.firstCall.args).to.be.deep.equal(['APISuccess', undefined]);
    });

    it('should call message.verify', () => {
      let msg: any;
      let verifySpy: SinonSpy;
      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg       = (instance2 as any).getMessageInstance(namespace, messageType);
        verifySpy = sandbox.spy(msg, 'verify');
        return msg;
      };
      instance.validate(payload, 'APISuccess');
      expect(verifySpy.calledOnce).to.be.true;
      expect(verifySpy.firstCall.args).to.be.deep.equal([payload]);
    });

    it('should return true if message.verify returns null', () => {
      let msg: any;
      let verifyStub: SinonSpy;
      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg        = (instance2 as any).getMessageInstance(namespace, messageType);
        verifyStub = sandbox.stub(msg, 'verify').returns(null);
        return msg;
      };
      const ret                            = instance.validate(payload, 'APISuccess');
      expect(ret).to.be.true;
    });

    it('should set lastError, call logger.debug and return false if message.verify returns an error message', () => {
      let msg: any;
      let verifyStub: SinonSpy;
      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg        = (instance2 as any).getMessageInstance(namespace, messageType);
        verifyStub = sandbox.stub(msg, 'verify').returns('Test Err');
        return msg;
      };
      const ret                            = instance.validate(payload, 'APISuccess');
      expect(ret).to.be.false;
      expect(instance.lastError).to.be.equal('Protobuf verify error [APISuccess undefined]: Test Err');
      expect(fakeLogger.debug.calledOnce).to.be.true;
      expect(fakeLogger.debug.firstCall.args).to.be.deep.equal([
        'Protobuf verify error. Test Err',
        JSON.stringify({ payload, namespace: 'APISuccess' }),
      ]);
    });
  });

  // tslint:disable max-line-length
  describe('encode', () => {
    let payload: any;
    let getMsgInstSpy: SinonSpy;

    beforeEach(() => {
      payload = { success: true, message: 'Success' };
    });

    it('should call validate and return null if payload is not validated', () => {
      const validateStub = sandbox.stub(instance as any, 'validate').returns(false);
      const ret          = instance.encode(payload, 'APISuccess');
      expect(ret).to.be.null;
      expect(validateStub.calledOnce).to.be.true;
      expect(validateStub.firstCall.args).to.be.deep.equal([payload, 'APISuccess', undefined]);
    });

    it('should call getMessageInstance', () => {
      getMsgInstSpy = sandbox.spy(instance as any, 'getMessageInstance');
      instance.encode(payload, 'APISuccess');
      expect(getMsgInstSpy.calledTwice).to.be.true;
      expect(getMsgInstSpy.secondCall.args).to.be.deep.equal(['APISuccess', undefined]);
    });

    it('should call message.encode and finish', () => {
      let msg: any;
      let encodeSpy: SinonSpy;
      let finishSpy: SinonSpy;

      // What a pain testing chained methods...
      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg             = (instance2 as any).getMessageInstance(namespace, messageType);
        const oldEncode = msg.encode;
        msg.encode      = (pl) => {
          const m   = oldEncode(pl);
          finishSpy = sandbox.spy(m, 'finish');
          return m;
        };
        encodeSpy       = sandbox.spy(msg, 'encode');
        return msg;
      };

      instance.encode(payload, 'APISuccess');
      expect(encodeSpy.calledOnce).to.be.true;
      expect(encodeSpy.firstCall.args).to.be.deep.equal([payload]);
      expect(finishSpy.calledOnce).to.be.true;
    });

    it('should return a buffer', () => {
      const b = instance.encode(payload, 'APISuccess');
      expect(Buffer.isBuffer(b)).to.be.true;
    });

    describe('input/output tests', () => {
      it('should encode APIError as expected', () => {
        const obj = { success: false, error: 'Error' };
        const buf = Buffer.from('080012054572726f72', 'hex');
        const out = instance.encode(obj, 'APIError') as Buffer;
        // console.log(out.toString('hex'));
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode APISuccess as expected', () => {
        const obj = { success: true, message: 'Success' };
        const buf = Buffer.from('0801120753756363657373', 'hex');
        const out = instance.encode(obj, 'APISuccess') as Buffer;
        // console.log(out.toString('hex'));
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode bytesBlock as expected', () => {
        const obj = {
          bytes       : Buffer.from('0000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f', 'hex'),
          height      : 6,
          transactions: [
            {
              bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
              fee                  : 10000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
            {
              bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
              fee                  : 100000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
          ],
        };
        const buf = Buffer.from('0ab0010000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f1280010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade20412c2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f1806', 'hex');
        const out = instance.encode(obj, 'bytesBlock') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode bytesTransaction as expected', () => {
        const obj = {
          bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
          fee                  : 123456789,
          hasRequesterPublicKey: false,
          hasSignSignature     : false,
        };
        const buf = Buffer.from('0a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c1000180020959aef3a', 'hex');
        const out = instance.encode(obj, 'bytesTransaction') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode transportBlocks as expected', () => {
        const obj = {
          blocks: [{
            bytes       : Buffer.from('0000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f', 'hex'),
            height      : 6,
            transactions: [
              {
                bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
                fee                  : 10000000,
                hasRequesterPublicKey: false,
                hasSignSignature     : false,
              },
              {
                bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
                fee                  : 100000000,
                hasRequesterPublicKey: false,
                hasSignSignature     : false,
              },
            ],
          }],
        };
        const buf = Buffer.from('0afd030ab0010000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f1280010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade20412c2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f1806', 'hex');
        const out = instance.encode(obj, 'transportBlocks') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode transportPeers as expected', () => {
        const obj = {
          peers: [
            {
              ip: '127.0.0.1',
              port: 5555,
              state: 2,
              os: 'linux',
              version: '1.1.1',
              broadhash: '123124125152asdadf',
              height: 5,
              clock: 86400,
              updated: Long.fromString('10', true),
              nonce: 'nonce1',
            },
            {
              ip: '127.0.0.2',
              port: 5535,
              state: 3,
              os: 'ubuntu',
              version: '1.0.1',
              broadhash: 'asdadf1342352352352',
              height: 5,
              clock: 865600,
              updated: Long.fromString('12', true),
              nonce: 'nonce2',
            },
          ],
        };
        const buf = Buffer.from('0a420a093132372e302e302e3110b32b180222056c696e75782a05312e312e31321231323331323431323531353261736461646638054080a305480a52066e6f6e6365310a440a093132372e302e302e32109f2b180322067562756e74752a05312e302e31321361736461646631333432333532333532333532380540c0ea34480c52066e6f6e636532', 'hex');
        const out = instance.encode(obj, 'transportPeers') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode transportSignatures as expected', () => {
        const obj = {
          signatures: [
            {
              signature: Buffer.from('82a05312e312e31321231323331323431323531353261736461646638054080a', 'hex'),
              transaction: Long.fromString('1233578365736487563874', true),
            },
            {
              signature: Buffer.from('31323431323531353261736461646638054080a82a05312e312e313212313233', 'hex'),
              transaction: Long.fromString('5438588365736487563874', true),
            },
          ],
        };
        const buf = Buffer.from('0a2d08e2e4f4d1befbaeabdf01122082a05312e312e31321231323331323431323531353261736461646638054080a0a2d08e2e4c8fcadf8d1c9d301122031323431323531353261736461646638054080a82a05312e312e313212313233', 'hex');
        const out = instance.encode(obj, 'transportSignatures', 'postSignatures') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });

      it('should encode transportTransactions as expected', () => {
        const obj = {
          transactions: [
            {
              bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
              fee                  : 10000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
            {
              bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
              fee                  : 100000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
          ],
        };
        const buf = Buffer.from('0a80010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade2040ac2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f', 'hex');
        const out = instance.encode(obj, 'transportTransactions') as Buffer;
        expect(out).to.be.deep.equal(buf);
      });
    });
  });

  describe('decode', () => {
    let buf: Buffer;
    let getMsgInstSpy: SinonSpy;

    beforeEach(() => {
      buf = Buffer.from('0801120753756363657373', 'hex');
    });

    it('should call getMessageInstance', () => {
      getMsgInstSpy = sandbox.spy(instance as any, 'getMessageInstance');
      instance.decode(buf, 'APISuccess');
      expect(getMsgInstSpy.calledOnce).to.be.true;
      expect(getMsgInstSpy.firstCall.args).to.be.deep.equal(['APISuccess', undefined]);
    });

    it('should return null if getMessageInstance returns null', () => {
      sandbox.stub(instance as any, 'getMessageInstance').returns(null);
      const ret = instance.decode(buf, 'APISuccess');
      expect(ret).to.be.null;
    });

    it('should call message.decode and return if decode does not throw', () => {
      let msg: any;
      let decodeSpy: SinonSpy;

      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg             = (instance2 as any).getMessageInstance(namespace, messageType);
        decodeSpy       = sandbox.stub(msg, 'decode').returns('decoded');
        return msg;
      };
      const ret = instance.decode(buf, 'APISuccess');
      expect(decodeSpy.calledOnce).to.be.true;
      expect(ret).to.be.equal('decoded');
    });

    it('should throw if a ProtocolError is caught', () => {
      let msg: any;
      let decodeSpy: SinonSpy;

      (instance as any).getMessageInstance = (namespace, messageType) => {
        msg             = (instance2 as any).getMessageInstance(namespace, messageType);
        decodeSpy       = sandbox.stub(msg, 'decode').throws(new ProtocolError('protoerr'));
        return msg;
      };
      expect(() => { instance.decode(buf, 'APISuccess'); }).to.throw('ProtoBuf Protocol Error protoerr');
    });

    it('should throw if wire format is invalid', () => {
      expect(() => {
        instance.decode(Buffer.from('aaabbbcccddd', 'hex'), 'APISuccess');
      }).to.throw(/ProtoBuf Wire format invalid/);
    });

    describe('input/output tests', () => {
      it('should decode APIError as expected', () => {
        const obj = { success: false, error: 'Error' };
        const buf = Buffer.from('080012054572726f72', 'hex');
        const out = instance.decodeToObj(buf, 'APIError');
        // console.log(out.toString('hex'));
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode APISuccess as expected', () => {
        const obj = { success: true, message: 'Success' };
        const buf = Buffer.from('0801120753756363657373', 'hex');
        const out = instance.decodeToObj(buf, 'APISuccess');
        // console.log(out.toString('hex'));
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode bytesBlock as expected', () => {
        const obj = {
          bytes       : Buffer.from('0000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f', 'hex'),
          height      : 6,
          transactions: [
            {
              bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
              fee                  : 10000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
            {
              bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
              fee                  : 100000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
          ],
        };
        const buf = Buffer.from('0ab0010000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f1280010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade20412c2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f1806', 'hex');
        const out = instance.decodeToObj(buf, 'bytesBlock');
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode bytesTransaction as expected', () => {
        const obj = {
          bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
          fee                  : 123456789,
          hasRequesterPublicKey: false,
          hasSignSignature     : false,
        };
        const buf = Buffer.from('0a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c1000180020959aef3a', 'hex');
        const out = instance.decodeToObj(buf, 'bytesTransaction');
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode transportBlocks as expected', () => {
        const obj = {
          blocks: [{
            bytes       : Buffer.from('0000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f', 'hex'),
            height      : 6,
            transactions: [
              {
                bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
                fee                  : 10000000,
                hasRequesterPublicKey: false,
                hasSignSignature     : false,
              },
              {
                bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
                fee                  : 100000000,
                hasRequesterPublicKey: false,
                hasSignSignature     : false,
              },
            ],
          }],
        };
        const buf = Buffer.from('0afd030ab0010000000096000000b179eacf8031c87102000000010000000000000080778e060000000000000000000000002b0100000857ce65156ace7fbdf2b30357fbb29157d5e2ea7f5038280e20177254c9d584b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dcaff0ed70afbba01ba7a5e297178557ca91b1f41cd295029f66a172686a82f7a75b8b1c5e8a01325b967e691c1ff195c6fff2546e1e1152811ec4adb7042992e0f1280010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade20412c2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f1806', 'hex');
        const out = instance.decodeToObj(buf, 'transportBlocks');
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode transportPeers as expected', () => {
        const obj = {
          peers: [
            {
              ip: '127.0.0.1',
              port: 5555,
              state: 2,
              os: 'linux',
              version: '1.1.1',
              broadhash: '123124125152asdadf',
              height: 5,
              clock: 86400,
              updated: Long.fromString('10', true),
              nonce: 'nonce1',
            },
            {
              ip: '127.0.0.2',
              port: 5535,
              state: 3,
              os: 'ubuntu',
              version: '1.0.1',
              broadhash: 'asdadf1342352352352',
              height: 5,
              clock: 865600,
              updated: Long.fromString('12', true),
              nonce: 'nonce2',
            },
          ],
        };
        const buf = Buffer.from('0a420a093132372e302e302e3110b32b180222056c696e75782a05312e312e31321231323331323431323531353261736461646638054080a305480a52066e6f6e6365310a440a093132372e302e302e32109f2b180322067562756e74752a05312e302e31321361736461646631333432333532333532333532380540c0ea34480c52066e6f6e636532', 'hex');
        const out = instance.decodeToObj(buf, 'transportPeers');
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode transportSignatures as expected', () => {
        const obj = {
          signatures: [
            {
              signature: Buffer.from('82a05312e312e31321231323331323431323531353261736461646638054080a', 'hex'),
              transaction: Long.fromString('1233578365736487563874', true),
            },
            {
              signature: Buffer.from('31323431323531353261736461646638054080a82a05312e312e313212313233', 'hex'),
              transaction: Long.fromString('5438588365736487563874', true),
            },
          ],
        };
        const buf = Buffer.from('0a2d08e2e4f4d1befbaeabdf01122082a05312e312e31321231323331323431323531353261736461646638054080a0a2d08e2e4c8fcadf8d1c9d301122031323431323531353261736461646638054080a82a05312e312e313212313233', 'hex');
        const out = instance.decodeToObj(buf, 'transportSignatures', 'postSignatures');
        expect(out).to.be.deep.equal(obj);
      });

      it('should decode transportTransactions as expected', () => {
        const obj = {
          transactions: [
            {
              bytes                : Buffer.from('00000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c', 'hex'),
              fee                  : 10000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
            {
              bytes                : Buffer.from('03000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07', 'hex'),
              fee                  : 100000000,
              hasRequesterPublicKey: false,
              hasSignSignature     : false,
            },
          ],
        };
        const buf = Buffer.from('0a80010a7500000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c1f2ca97bc506a79c01000000000000003b34dc15ee272fe62199d4132ada6cde9ad642b64b2ef147019b300f956b4ccd3ea40af2abaad14396fd559e444cfc21359fc5146d093a5045f6eea0e3bf990c100018002080ade2040ac2010ab60103000000005cc9c10582e3ea3d1c9c44d6163bc5364c4d3f1d38f1db7c0d56e4173703070c075f22e6468dd94100000000000000002b353634346563396438646432326666633030643036323562623564646135623932393932626336616135626537383230656363666535353434336632663462343989815ad37d0e9fd2a59d409757a1fdd7840ceaef5491029d6f1d32d5d0aaada0b04e374d83751bf14e1e6ebc0517a21941d185cf9fb5af299eccb2b94b4c07100018002080c2d72f', 'hex');
        const out = instance.decodeToObj(buf, 'transportTransactions');
        expect(out).to.be.deep.equal(obj);
      });
    });
  });

  describe('decodeToObj', () => {
    let buf: Buffer;
    let getMsgInstSpy: SinonSpy;

    beforeEach(() => {
      buf = Buffer.from('0801120753756363657373', 'hex');
    });

    it('should call getMessageInstance twice', () => {
      getMsgInstSpy = sandbox.spy(instance as any, 'getMessageInstance');
      instance.decodeToObj(buf, 'APISuccess');
      expect(getMsgInstSpy.calledTwice).to.be.true;
      expect(getMsgInstSpy.firstCall.args).to.be.deep.equal(['APISuccess', undefined]);
    });

    it('should call inst.decode', () => {
      let decodeSpy: SinonSpy;
      decodeSpy = sandbox.spy(instance, 'decode');
      instance.decodeToObj(buf, 'APISuccess');
      expect(decodeSpy.calledOnce).to.be.true;
      expect(decodeSpy.firstCall.args).to.be.deep.equal([buf, 'APISuccess', undefined]);
    });
    it('should throw if decode throws', () => {
      sandbox.stub(instance, 'decode').throws(new Error('erroor'));
      expect(() => {
        instance.decodeToObj(buf, 'APISuccess');
      }).to.throw('decodeToObject error: erroor');
    });

    it('should call postProcess if passed into converters and return the result', () => {
      const postProcess = sandbox.stub().callsFake((a) => a);
      instance.decodeToObj(buf, 'APISuccess', undefined, {postProcess});
      expect(postProcess.calledOnce).to.be.true;
      expect(postProcess.firstCall.args).to.be.deep.equal([{ success: true, message: 'Success' }]);
    });

    it('should return a serializable object', () => {
      const retVal = instance.decodeToObj(buf, 'APISuccess');
      expect(retVal).to.be.deep.equal(JSON.parse(JSON.stringify(retVal)));
    });
  });
});
