import { expect } from 'chai';
import {BigNum, Longnum} from '../../../src/helpers';

describe('helpers/longnum', () => {

  describe('fromBuffer', () => {
    it('Longnum.toString() and Bignum.toString() should match', () => {
      const address = 2841811297332056155;
      const hex = Number(address).toString(16);
      const buf = Buffer.from(hex, 'hex'); // hex to buffer
      const long = Longnum.fromBuffer(buf); // buffer to Long
      const bignum = BigNum.fromBuffer(buf); // buffer to bignum
      expect(long.toString(10)).to.be.equal(bignum.toString(10));
      expect(long.toNumber()).to.be.equal(address);
    });
  });

  describe('toBuffer', () => {
    it('Longnum.toString() and Bignum.toString() should match', () => {
      const address = '2841811297332056155';
      const long = Longnum.fromString(address, true, 10);
      const bignum = new BigNum(address);
      const b1 = Longnum.toBuffer(long);
      const b2 = bignum.toBuffer();
      expect(b1).to.deep.equal(b2);
      expect(b1.toString('hex')).to.be.equal(b2.toString('hex'));
    });
  });


});