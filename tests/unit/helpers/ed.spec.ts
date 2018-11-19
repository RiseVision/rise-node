import { expect } from 'chai';
import { Ed, IKeypair } from '../../../src/helpers';

const realEd          = new Ed();
const inputSeedHex  = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0';
const publicKeyHex  = '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
const privateKeyHex = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0' +
  '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
const messageHash   = '84c824f93d07657b8cd49fe2d4f96d06ab5eda4d29c3d3a4ea87e65fa8fc0732';
const signatureHex  = 'b2c9aab1ee31cecfe2a0547fe9e70f4d89d505e3f05c0f777f32cdc3dbb79fcd' +
  '87afb70f2a3a04cae3d65b1a89b226d2974844f909686b125f0d07254961b104';

// tslint:disable no-unused-expression
describe('helpers/ed', () => {

  describe('constructor', () => {
    it('should create an instance of Ed', () => {
      expect(new Ed()).to.be.instanceOf(Ed);
    });
  });

  describe('makeKeypair', () => {
    it('should return object', () => {
      const retval = realEd.makeKeypair(new Buffer(new Array(32).fill('a')));
      expect(retval).to.be.an('object');
    });
    it('should return calculated data', () => {
      const inputSeed                    = Buffer.from(inputSeedHex, 'hex');
      const expectedOutputKeys: IKeypair = {
        privateKey: Buffer.from(privateKeyHex, 'hex'),
        publicKey : Buffer.from(publicKeyHex, 'hex'),
      };

      const ret = realEd.makeKeypair(inputSeed);
      expect(ret).deep.eq(expectedOutputKeys);
    });
    it('should throw if string is provided', () => {
      expect(() => realEd.makeKeypair(inputSeedHex as any)).to.throw();
    });
    it('should throw if buffer is not 32 byte long', () => {
      expect(() => realEd.makeKeypair(Buffer.from(inputSeedHex.substr(2), 'hex'))).to.throw();
    });
  });

  describe('sign', () => {
    it('sign should return the expected output', () => {
      const outputSignature = realEd.sign(
        Buffer.from(messageHash),
        realEd.makeKeypair(Buffer.from(inputSeedHex, 'hex'))
      );
      expect(outputSignature).to.be.deep.equal(Buffer.from(signatureHex, 'hex'));
    });
    it('should throw if message is not buffer', () => {
      expect(() => realEd.sign(
        messageHash as any,
        realEd.makeKeypair(Buffer.from(inputSeedHex, 'hex'))
      )).to.throw();
    });
  });

  describe('verify', () => {
    const keyPair = realEd.makeKeypair(Buffer.from(inputSeedHex, 'hex'));
    it('should verify signed message', () => {
      for (let i = 0; i < 1000; i++) {
        const msg = new Buffer(`rise${i}`);
        expect(realEd.verify(
          msg,
          realEd.sign(msg, keyPair),
          keyPair.publicKey
        )).to.be.true;
      }
    });
    it('should return false if message is not correct but valid signature', () => {
      for (let i = 0; i < 1000; i++) {
        const msg = new Buffer(`rise${i}`);
        expect(realEd.verify(
          new Buffer('hey'),
          realEd.sign(msg, keyPair),
          keyPair.publicKey
        )).to.be.false;
      }
    });
    it('should throw if msg is string', () => {
      expect(() => realEd.verify(
        'hey' as any,
        realEd.sign(new Buffer('hey'), keyPair),
        keyPair.publicKey))
        .to.throw();
    });
    it('should throw if signature is string', () => {
      expect(() => realEd.verify(
        new Buffer('hey'),
        realEd.sign(new Buffer('hey'), keyPair).toString('hex') as any,
        keyPair.publicKey))
        .to.throw();
    });
  });

});
