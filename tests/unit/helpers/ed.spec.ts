import {expect} from 'chai';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { Ed } from '../../../src/helpers';
import { SinonStub } from 'sinon';
// tslint:disable no-unused-expression
const RewireEd = rewire('../../../src/helpers/ed');
const sodium = RewireEd.__get__('sodium_1');

describe('helpers/ed', () => {
  let rewiredInst: Ed;
  beforeEach(() => {
    rewiredInst = new RewireEd.Ed();
  });

  describe('constructor', () => {
    it('should create an instance of Ed', () => {
      expect(new Ed()).to.be.instanceOf(Ed);
    });
  });

  describe('makeKeypair', () => {
    let oldImplementation;
    let stub: SinonStub;

    beforeEach(() => {
      oldImplementation = sodium.api.crypto_sign_seed_keypair;
      stub = sinon.stub(sodium.api, 'crypto_sign_seed_keypair')
        .returns({secretKey: 'a', publicKey: 'b'});
    });
    afterEach(() => {
      sodium.api.crypto_sign_seed_keypair = oldImplementation;
    });

    it('should return object', () => {
      const retval = rewiredInst.makeKeypair(new Buffer('aaaa'));
      expect(retval).to.be.an('object');
    });
    it('should call sodium.crypto_sign_seed_keypair', () => {
      rewiredInst.makeKeypair(new Buffer('aaaa'));
      expect(stub.called).is.true;
    });
    it('should pass hash to sodium.crypto_sign_seed_keypair', () => {
      const hash = new Buffer('aaaa');
      rewiredInst.makeKeypair(hash);
      expect(stub.firstCall.args[0]).to.be.deep.eq(hash);
    });
    it('should use sodium output to build return value', () => {
      stub.returns({secretKey: 'privASD', publicKey: 'pubASD'});
      const expectedReturn = {privateKey: 'privASD', publicKey: 'pubASD'};
      const retval = rewiredInst.makeKeypair(new Buffer('aaaa'));
      expect(retval).to.be.deep.eq(expectedReturn);
    });
  });

  describe('sign', () => {
    it('should call sodium.crypto_sign_detached');
    it('should pass hash and keypair to sodium.crypto_sign_detached');
    it('should return the result of sodium.crypto_sign_detached');
  });

  describe('verify', () => {
    let stub: SinonStub;
    let oldImplementation;
    beforeEach(() => {
      oldImplementation = sodium.api.crypto_sign_verify_detached;
      stub = sinon.stub(sodium.api, 'crypto_sign_verify_detached').returns(true);
    });
    afterEach(() => {
      sodium.api.crypto_sign_verify_detached = oldImplementation;
    });
    it('should call sodium.crypto_sign_verify_detached');
    it('should pass params in correct order to sodium.crypto_sign_verify_detached', () => {
      const args = [new Buffer('hash'), new Buffer('signature'), new Buffer('publicKey')];
      rewiredInst.verify(args[0], args[1], args[2]);
      expect(stub.firstCall.args).to.deep.eq([args[1], args[0], args[2]]);
    });
    it('should return the result of sodium.crypto_sign_verify_detached');
  });

});
