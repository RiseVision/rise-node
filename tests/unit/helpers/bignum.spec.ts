import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import * as crypto from 'crypto';
import { BigNum } from '../../../src/helpers';
import MyBigNumb from '../../../src/helpers/bignum';

describe('helpers/bignum', () => {
  describe('fromBuffer', () => {

    it('should return a BigNumber', () => {
      const bn = MyBigNumb.fromBuffer(Buffer.from('11223344556677889900ff', 'hex'));
      expect(bn).to.be.instanceOf(BigNumber);
    });

    it('should throw error when buffer length and size are not multiples', () => {
      expect(() => {
        const bn = MyBigNumb.fromBuffer(Buffer.from('11223344556677889900ff', 'hex'), { size: 3 });
      }).to.throw(Error, /multiple/);
    });

    it('should zero-pad chunks lower than 16', () => {
      const bn = MyBigNumb.fromBuffer(Buffer.from('110fcc', 'hex'));
      expect(bn.toString(16)).to.be.eq('110fcc');
    });

    it('should return the expected value', () => {
      // In RISE, this function is used with SHA-256 hashes as input, like this:
      // 298060b98876a71d422b03ea601aee4625eb883bdd317e7556dbe4cbb0ab57d3
      const hash = crypto.createHash('sha256').update('Testing helpers/bignum.ts').digest();
      const buf  = BigNum.fromBuffer(hash);
      expect(buf.toString(16)).to.be.deep.equal('298060b98876a71d422b03ea601aee4625eb883bdd317e7556dbe4cbb0ab57d3');
    });

  });

  describe('toBuffer', () => {
    it('should return a buffer', () => {
      const bn  = new MyBigNumb('18223573544561351465');
      const buf = bn.toBuffer();
      expect(buf).to.be.instanceOf(Buffer);
    });

    it('should throw an error if number is negative', () => {
      const bn = new MyBigNumb('-18223573544561351465');
      expect(() => {
        bn.toBuffer();
      }).to.throw(Error, /negative/);
    });

    it('should zero-pad', () => {
      const bn  = new MyBigNumb('18223573544561351465');
      const buf = bn.toBuffer({ size: 6 });
      expect(buf.toString('hex')).to.be.eq('00000000fce723960dc91b29');
    });

    // In RISE toBuffer is called with size 8 for block IDs, like 17106814500804965614
    it('should return the expected value', () => {
      const bn  = new MyBigNumb('17106814500804965614');
      const expectedBuffer = Buffer.from('ed679d2716fb34ee', 'hex');
      const buf = bn.toBuffer({ size: 8 });
      expect(buf).to.be.deep.eq(expectedBuffer);
    });
  });
});
