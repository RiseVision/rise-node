import 'reflect-metadata';
import { IKeypair } from '@risevision/core-types';
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import * as sodium from 'sodium';
import { Crypto } from '../../src';

const realCrypto      = new Crypto();
const sodiumStub: any = {};

// tslint:disable no-unused-expression
describe('helpers/crypto', () => {
  let proxiedInst: Crypto;
  const ProxiedEd = proxyquire('../../src/crypto', {
    sodium: sodiumStub,
  });

  beforeEach(() => {
    sodiumStub.api = sodium.api;
    proxiedInst    = new ProxiedEd.Crypto();
  });

  describe('constructor', () => {
    it('should create an instance of Ed', () => {
      expect(new Crypto()).to.be.instanceOf(Crypto);
    });
  });

  describe('makeKeyPair', () => {
    const oldImplementation = sodium.api.crypto_sign_seed_keypair;
    let stub: SinonStub;

    beforeEach(() => {
      stub = sinon.stub(sodium.api, 'crypto_sign_seed_keypair')
        .returns({ secretKey: 'a', publicKey: 'b' });
    });

    afterEach(() => {
      sodium.api.crypto_sign_seed_keypair = oldImplementation;
    });

    it('should return object', () => {
      const retval = proxiedInst.makeKeyPair(new Buffer('aaaa'));
      expect(retval).to.be.an('object');
    });

    it('should call sodium.crypto_sign_seed_keypair', () => {
      proxiedInst.makeKeyPair(new Buffer('aaaa'));
      expect(stub.called).is.true;
    });

    it('should pass hash to sodium.crypto_sign_seed_keypair', () => {
      const hash = new Buffer('aaaa');
      proxiedInst.makeKeyPair(hash);
      expect(stub.firstCall.args[0]).to.be.deep.eq(hash);
    });

    it('should use sodium output to build return value', () => {
      stub.returns({ secretKey: 'privASD', publicKey: 'pubASD' });
      const expectedReturn = { privateKey: 'privASD', publicKey: 'pubASD' };
      const retval         = proxiedInst.makeKeyPair(new Buffer('aaaa'));
      expect(retval).to.be.deep.eq(expectedReturn);
    });
  });

  describe('sign', () => {
    let stub: SinonStub;
    const hashBuf           = new Buffer('hash');
    const outBuf            = new Buffer('output');
    const keyPair           = realCrypto.makeKeyPair(new Buffer('12345678901234567890123456789012'));
    const oldImplementation = sodium.api.crypto_sign_detached;

    beforeEach(() => {
      stub = sinon.stub(sodium.api, 'crypto_sign_detached').returns(outBuf);
    });

    afterEach(() => {
      sodium.api.crypto_sign_detached = oldImplementation;
    });

    it('should call sodium.crypto_sign_detached', () => {
      proxiedInst.sign(hashBuf, keyPair);
      expect(stub.called).to.be.true;
    });

    it('should pass hash and keypair to sodium.crypto_sign_detached', () => {
      proxiedInst.sign(hashBuf, keyPair);
      expect(stub.firstCall.args[0]).to.be.deep.equal(hashBuf);
      expect(stub.firstCall.args[1]).to.be.deep.equal(keyPair.privateKey);
    });

    it('should return the result of sodium.crypto_sign_detached', () => {
      const retVal = proxiedInst.sign(hashBuf, keyPair);
      expect(retVal).to.be.deep.equal(outBuf);
    });
  });

  describe('verify', () => {
    let stub: SinonStub;
    const args              = [new Buffer('hash'), new Buffer('signature'), new Buffer('publicKey')];
    const oldImplementation = sodium.api.crypto_sign_verify_detached;

    beforeEach(() => {
      stub = sinon.stub(sodium.api, 'crypto_sign_verify_detached').returns(true);
    });

    afterEach(() => {
      sodium.api.crypto_sign_verify_detached = oldImplementation;
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
    const inputSeedHex  = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0';
    const publicKeyHex  = '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
    const privateKeyHex = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0' +
      '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
    const messageHash   = '84c824f93d07657b8cd49fe2d4f96d06ab5eda4d29c3d3a4ea87e65fa8fc0732';
    const signatureHex  = 'b2c9aab1ee31cecfe2a0547fe9e70f4d89d505e3f05c0f777f32cdc3dbb79fcd' +
      '87afb70f2a3a04cae3d65b1a89b226d2974844f909686b125f0d07254961b104';

    const inputSeed                    = Buffer.from(inputSeedHex, 'hex');
    const expectedOutputKeys: IKeypair = {
      privateKey: Buffer.from(privateKeyHex, 'hex'),
      publicKey : Buffer.from(publicKeyHex, 'hex'),
    };
    const inputMessage                 = Buffer.from(messageHash);
    const expectedOutputSignature      = Buffer.from(signatureHex, 'hex');

    it('makeKeyPair should return the expected output', () => {
      const outputKeys = realCrypto.makeKeyPair(inputSeed);
      expect(outputKeys).to.be.deep.equal(expectedOutputKeys);
    });

    it('sign should return the expected output', () => {
      const outputSignature = realCrypto.sign(inputMessage, expectedOutputKeys);
      expect(outputSignature).to.be.deep.equal(expectedOutputSignature);
    });

    it('verify should return the expected output', () => {
      const isVerified = realCrypto.verify(inputMessage, expectedOutputSignature, expectedOutputKeys.publicKey);
      expect(isVerified).to.be.true;
    });
  });
});
