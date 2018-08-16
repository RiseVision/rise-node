import { expect } from 'chai';
import {BigNum, Longnum} from '../../../src/helpers';

describe('helpers/longnum', () => {

  describe('fromBuffer', () => {
    it('Case #1: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '16415345829235982109';
      const buf = Buffer.from('E3CF060F38CCFF1D', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #2: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '350732797691587555';
      const buf = Buffer.from('04DE0D9F097C6BE3', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #3: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '8988057841420603915';
      const buf = Buffer.from('7CBBFEFC6A8A120B', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #4: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '13954800680910418410';
      const buf = Buffer.from('C1A96948990B71EA', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #5: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685248';
      const buf = Buffer.from('0008000000000000', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #6: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685247';
      const buf = Buffer.from('0007FFFFFFFFFFFF', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #7: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685249';
      const buf = Buffer.from('0008000000000001', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });

    it('Case #8: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '18446744073709551615';
      const buf = Buffer.from('FFFFFFFFFFFFFFFF', 'hex');
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toString(10)).to.be.equal(address);
    });
  });

  describe('toBuffer', () => {
    it('Case #1: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '16415345829235982109';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });
    it('Case #2: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '350732797691587555';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });
    it('Case #3: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '8988057841420603915';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });

    it('Case #4: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '13954800680910418410';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });

    it('Case #5: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685248';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });

    it('Case #6: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685247';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });

    it('Case #7: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2251799813685249';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });

    it('Case #8: Longnum.toString() and Bignum.toString() should match', () => {
      const address = '18446744073709551615';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });
  });
});
