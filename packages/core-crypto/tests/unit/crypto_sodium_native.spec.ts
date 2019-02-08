import { IKeypair } from '@risevision/core-types';
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import * as sodium from 'sodium-native';
import { As } from 'type-tagger';
import { Crypto } from '../../src/crypto_sodium_native';

const realCrypto = new Crypto();
const sodiumStub: any = {};

// tslint:disable no-unused-expression
describe('helpers/crypto(sodium-native)', () => {
  let proxiedInst: Crypto;
  const ProxiedEd = proxyquire('../../src/crypto_sodium_native', {
    sodium: sodiumStub,
  });

  beforeEach(() => {
    sodiumStub.crypto_sign_seed_keypair = sodium.crypto_sign_seed_keypair;
    sodiumStub.crypto_sign_detached = sodium.crypto_sign_detached;
    sodiumStub.crypto_sign_verify_detached = sodium.crypto_sign_verify_detached;
    proxiedInst = new ProxiedEd.Crypto();
  });

  describe('constructor', () => {
    it('should create an instance of Ed', () => {
      expect(new Crypto()).to.be.instanceOf(Crypto);
    });
  });

  describe('makeKeyPair', () => {
    const oldImplementation = sodium.crypto_sign_seed_keypair;
    let stub: SinonStub;

    beforeEach(() => {
      stub = sinon
        .stub(sodium, 'crypto_sign_seed_keypair')
        .returns({ secretKey: 'a', publicKey: 'b' });
    });

    afterEach(() => {
      sodium.crypto_sign_seed_keypair = oldImplementation;
    });

    it('should return object', () => {
      const retval = proxiedInst.makeKeyPair(Buffer.from('aaaa', 'utf8'));
      expect(retval).to.be.an('object');
    });

    it('should call sodium.crypto_sign_seed_keypair', () => {
      proxiedInst.makeKeyPair(Buffer.from('aaaa', 'utf8'));
      expect(stub.called).is.true;
    });

    it('should pass empty buffers as first 2 parameters to sodium.crypto_sign_seed_keypair', () => {
      const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES) as Buffer & As<'publicKey'>;
      const privateKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES) as Buffer & As<'privateKey'>;
      const hash = Buffer.from('aaaa', 'utf8');
      proxiedInst.makeKeyPair(hash);
      expect(stub.firstCall.args[0]).to.be.deep.eq(publicKey);
      expect(stub.firstCall.args[1]).to.be.deep.eq(privateKey);
    });

    it('should pass hash to sodium.crypto_sign_seed_keypair', () => {
      const hash = Buffer.from('aaaa', 'utf8');
      proxiedInst.makeKeyPair(hash);
      expect(stub.firstCall.args[2]).to.be.deep.eq(hash);
    });

    it('should use sodium output to build return value', () => {
      stub.restore();
      const spy = sinon.spy(sodium, 'crypto_sign_seed_keypair');
      const retval = proxiedInst.makeKeyPair(
        Buffer.from('12345678901234567890123456789012', 'utf8')
      );
      expect(retval).to.be.deep.eq({
        privateKey: spy.firstCall.args[1],
        publicKey: spy.firstCall.args[0],
      });
      spy.restore();
    });
  });

  describe('sign', () => {
    let stub: SinonStub;
    const hashBuf = Buffer.from('hash', 'utf8');
    const outBuf = Buffer.from('output', 'utf8');
    const keyPair = realCrypto.makeKeyPair(
      Buffer.from('12345678901234567890123456789012', 'utf8')
    );
    const oldImplementation = sodium.crypto_sign_detached;

    beforeEach(() => {
      stub = sinon.stub(sodium, 'crypto_sign_detached').returns(outBuf);
    });

    afterEach(() => {
      sodium.crypto_sign_detached = oldImplementation;
    });

    it('should call sodium.crypto_sign_detached', () => {
      proxiedInst.sign(hashBuf, keyPair);
      expect(stub.called).to.be.true;
    });

    it('should pass hash and keypair to sodium.crypto_sign_detached', () => {
      proxiedInst.sign(hashBuf, keyPair);
      expect(stub.firstCall.args[1]).to.be.deep.equal(hashBuf);
      expect(stub.firstCall.args[2]).to.be.deep.equal(keyPair.privateKey);
    });

    it('should return the result of sodium.crypto_sign_detached', () => {
      stub.restore();
      const spy = sinon.spy(sodium, 'crypto_sign_detached');
      const retVal = proxiedInst.sign(hashBuf, keyPair);
      expect(retVal).to.be.deep.equal(spy.firstCall.args[0]);
      spy.restore();
    });
  });

  describe('verify', () => {
    let stub: SinonStub;
    const args = [
      Buffer.from('hash', 'utf8'),
      Buffer.from('signature', 'utf8'),
      Buffer.from('publicKey', 'utf8'),
    ];
    const oldImplementation = sodium.crypto_sign_verify_detached;

    beforeEach(() => {
      stub = sinon.stub(sodium, 'crypto_sign_verify_detached').returns(true);
    });

    afterEach(() => {
      sodium.crypto_sign_verify_detached = oldImplementation;
    });

    it('should call sodium.crypto_sign_verify_detached', () => {
      proxiedInst.verify(args[0], args[1], args[2]);
      expect(stub.called).to.be.true;
    });

    it('should pass params in correct order to sodium.crypto_sign_verify_detached', () => {
      proxiedInst.verify(args[0], args[1], args[2]);
      expect(stub.firstCall.args).to.deep.eq([args[1], args[0], args[2]]);
    });

    it('should return the result of sodium.crypto_sign_verify_detached', () => {
      const retVal = proxiedInst.verify(args[0], args[1], args[2]);
      expect(retVal).to.be.true;
    });
  });

  describe('sodium input/output tests', () => {
    // LibSodium test input/outputs
    const inputSeedHex =
      'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0';
    const publicKeyHex =
      '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
    const privateKeyHex =
      'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0' +
      '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
    const messageHash =
      '84c824f93d07657b8cd49fe2d4f96d06ab5eda4d29c3d3a4ea87e65fa8fc0732';
    const signatureHex =
      'b2c9aab1ee31cecfe2a0547fe9e70f4d89d505e3f05c0f777f32cdc3dbb79fcd' +
      '87afb70f2a3a04cae3d65b1a89b226d2974844f909686b125f0d07254961b104';

    const inputSeed = Buffer.from(inputSeedHex, 'hex');
    const expectedOutputKeys: IKeypair = {
      privateKey: Buffer.from(privateKeyHex, 'hex') as Buffer & As<'privateKey'>,
      publicKey: Buffer.from(publicKeyHex, 'hex') as Buffer & As<'publicKey'>,
    };
    const inputMessage = Buffer.from(messageHash);
    const expectedOutputSignature = Buffer.from(signatureHex, 'hex');

    it('makeKeyPair should return the expected output', () => {
      const outputKeys = realCrypto.makeKeyPair(inputSeed);
      expect(outputKeys).to.be.deep.equal(expectedOutputKeys);
    });

    it('sign should return the expected output', () => {
      const outputSignature = realCrypto.sign(inputMessage, expectedOutputKeys);
      expect(outputSignature).to.be.deep.equal(expectedOutputSignature);
    });

    it('verify should return the expected output', () => {
      const isVerified = realCrypto.verify(
        inputMessage,
        expectedOutputSignature,
        expectedOutputKeys.publicKey
      );
      expect(isVerified).to.be.true;
    });
  });
});
