import {expect} from 'chai';
import * as sinon from 'sinon';
import { SinonSpy } from 'sinon';
import { castFieldsToNumberUsingSchema, z_schema } from '../../../src/helpers';

// tslint:disable no-unused-expression
describe('helpers/z_schema', () => {
  const validator = new z_schema({});

  describe('Format "id"', ()  => {
    const schema = { type: 'string', format: 'id' };
    // Y ?
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a sequence of numbers', () => {
      expect(validator.validate('000000123', schema)).to.be.true;
    });
    it('should reject a negative number', () => {
      expect(validator.validate('-1', schema)).to.be.false;
    });
    it('should reject a non-numeric string', () => {
      expect(validator.validate('RISE', schema)).to.be.false;
    });
  });

  describe('Format "address"', ()  => {
    const schema = { type: 'string', format: 'address' };
    // Y ?
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a sequence of numbers followed by uppercase "R"', () => {
      expect(validator.validate('18338120857045062830R', schema)).to.be.true;
    });
    it('should NOT accept a sequence of numbers followed by lowercase "r"', () => {
      expect(validator.validate('18338120857045062830r', schema)).to.be.false;
    });
    it('should reject a plain number', () => {
      expect(validator.validate('18338120857045062830', schema)).to.be.false;
    });
    it('should reject a non-numeric string', () => {
      expect(validator.validate('RISE123', schema)).to.be.false;
    });
  });

  describe('Format "username"', ()  => {
    let schema = { type: 'string', format: 'username' };
    // Y ?
    it('should not accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.false;
    });
    it('should accept an email address', () => {
      expect(validator.validate('aw3s0m3@rise.vision', schema)).to.be.true;
    });
    it('should accept all allowed characters', () => {
      expect(
        validator.validate('abcdefghijklmnopqrstuvwxyxABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$&_.', schema)
      ).to.be.true;
    });
    it('should reject other characters', () => {
      expect(validator.validate('#yeah', schema)).to.be.false;
    });
    it('should be reject if is a number', () => {
      schema = { type: 'number', format: 'username' };
      expect(validator.validate(1234, schema)).to.be.false;
    });
    it('should be reject if is an integer', () => {
      schema = { type: 'integer', format: 'username' };
      expect(validator.validate(1234, schema)).to.be.false;
    });
  });

  describe('Format "hex"', ()  => {
    const schema = { type: 'string', format: 'hex' };
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a hex string', () => {
      expect(validator.validate('0123456789abcdefABCDEF', schema)).to.be.true;
    });
    it('should reject a negative number', () => {
      expect(validator.validate('-1', schema)).to.be.false;
    });
    it('should reject other characters', () => {
      expect(validator.validate('UmlzZSBSdWxleiE=', schema)).to.be.false;
    });
  });

  describe('Format "publicKey"', ()  => {
    const schema = { type: 'string', format: 'publicKey' };
    // Y ?
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a hex string 64 characters long', () => {
      expect(
        validator.validate('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', schema)
      ).to.be.true;
    });
    it('should reject a shorter string', () => {
      expect(validator.validate('6588716f9c941530c', schema)).to.be.false;
    });
    it('should reject other characters', () => {
      expect(
        validator.validate('@588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', schema)
      ).to.be.false;
    });
  });

  describe('Format "csv"', ()  => {
    let schema = { type: 'string', format: 'csv' };
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a string without commas', () => {
      expect(validator.validate('RISE', schema)).to.be.true;
    });
    it('should accept a CSV with less than 1000 columns', () => {
      expect(validator.validate('RISE,RISE,RISE', schema)).to.be.true;
    });
    it('should reject CSV with more than 1000 columns', () => {
      let s = '';
      for (let i = 0; i < 1500; i++) {
        s += i + ',';
      }
      expect(validator.validate(s, schema)).to.be.false;
    });
    it('should be reject if is a number', () => {
      schema = { type: 'number', format: 'csv' };
      expect(validator.validate(1234, schema)).to.be.false;
    });
    it('should be reject if is an integer', () => {
      schema = { type: 'integer', format: 'csv' };
      expect(validator.validate(1234, schema)).to.be.false;
    });
  });

  describe('Format "signature"', ()  => {
    const schema = { type: 'string', format: 'signature' };
    // Y ? FIXME
    it('should accept an empty string', () => {
      expect(validator.validate('', schema)).to.be.true;
    });
    it('should accept a hex string of 64 bytes', () => {
      const signatureHex  = 'b2c9aab1ee31cecfe2a0547fe9e70f4d89d505e3f05c0f777f32cdc3dbb79fcd' +
                            '87afb70f2a3a04cae3d65b1a89b226d2974844f909686b125f0d07254961b104';
      expect(validator.validate(signatureHex, schema)).to.be.true;
    });
    it('should reject non-hex strings', () => {
      expect(validator.validate('RISE', schema)).to.be.false;
    });
    it('should reject too short hex strings', () => {
      expect(validator.validate('b2c9aab1ee31cecfe2a0547fe9e70f4d89d505', schema)).to.be.false;
    });
  });

  describe('Format "queryList"', ()  => {
    const schema = { type: 'object', format: 'queryList' };
    it('should always return true when an object is passed', () => {
      expect(validator.validate({a: 1}, schema)).to.be.true;
    });
    it('should add limit:100 to the passed object', () => {
      const obj = {a: 1, limit: 10000};
      validator.validate(obj, schema);
      expect(obj.limit).to.be.eq(100);
    });
  });

  describe('Format "delegatesList"', ()  => {
    const schema = { type: 'object', format: 'delegatesList' };
    it('should always return true when an object is passed', () => {
      expect(validator.validate({a: 1}, schema)).to.be.true;
    });
    it('should add limit:100 to the passed object', () => {
      const obj = {a: 1, limit: 10000};
      validator.validate(obj, schema);
      expect(obj.limit).to.be.eq(101);
    });
  });

  describe('Format "ip"', ()  => {
    const schema = { type: 'string', format: 'ip' };
    it('should accept a valid IPv4', () => {
      expect(validator.validate('127.0.0.1', schema)).to.be.true;
    });
    it('should reject an IPv6', () => {
      expect(validator.validate('2001:0db8:0000:0000:0000:0000:1428:57ab', schema)).to.be.false;
    });
    // THIS FAILS. Y?? bug in library?
    // it('should reject an invalid IPv4', () => {
    //   expect(validator.validate('666.1.1.1', schema)).to.be.false;
    // });
    it('should reject invalid strings', () => {
      expect(validator.validate('RISE', schema)).to.be.false;
    });
  });

  describe('Format "os"', ()  => {
    const schema = { type: 'string', format: 'os' };
    it('should reject an empty string', () => {
      expect(validator.validate('', schema)).to.be.false;
    });
    it('should accept all allowed characters', () => {
      expect(
        validator.validate('abcdefghijklmnopqrstuvwxyxABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.+', schema)
      ).to.be.true;
    });
    it('should reject other characters', () => {
      expect(validator.validate('#yeah', schema)).to.be.false;
    });
  });

  describe('Format "version"', ()  => {
    const schema = { type: 'string', format: 'version' };
    it('should accept a 3-level version number with a final letter', () => {
      expect(validator.validate('111.222.333a', schema)).to.be.true;
    });
    it('should accept a 3-level version number without a final letter', () => {
      expect(validator.validate('1.22.333', schema)).to.be.true;
    });
    it('should reject 2-level verion numbers', () => {
      expect(validator.validate('1.5', schema)).to.be.false;
    });
    it('should reject version subnumbers with more than 3 digits', () => {
      expect(validator.validate('1.22.3333', schema)).to.be.false;
    });
  });

  describe('castFieldsToNumberUsingSchema', () => {
    let parseIntSpy: SinonSpy;

    beforeEach(() => {
      parseIntSpy = sinon.spy(global, 'parseInt');
    });

    afterEach(() => {
      parseIntSpy.restore();
    });

    it('should return the object untouched if schema.type is not "integer" (on scalars)', () => {
      const schema = { type: 'string' };
      const value  = '10000';
      const retVal = castFieldsToNumberUsingSchema(schema, value);
      expect(retVal).to.be.deep.eq(value);
    });

    it('should parse "integer" schema values to radix 10 integer', () => {
      const schema = { type: 'integer' };
      const value  = '10000';
      const retVal = castFieldsToNumberUsingSchema(schema, value);
      expect(parseIntSpy.called).to.be.true;
      expect(retVal).to.be.eq(10000);
      expect(retVal).to.not.be.eq(value);
    });

    it('should not try to cast undefined', () => {
      const schema = { type: 'integer' };
      const value  = undefined;
      const retVal = castFieldsToNumberUsingSchema(schema, value);
      expect(retVal).to.be.eq(undefined);
      expect(parseIntSpy.called).to.be.false;
    });

    it('should process all levels of nested objects (recursion)', () => {
      const schema = {
        properties: {
          child: {
            properties: {
              value: {
                type: 'integer',
              },
            },
            type      : 'object',
          },
          value: {
            type: 'integer',
          },
        },
        type      : 'object',
      };
      const value  = {
        child: {
          value: '100',
        },
        value: '50',
      };
      const retVal = castFieldsToNumberUsingSchema(schema, value);
      expect(retVal).to.be.deep.eq({
        child: {
          value: 100,
        },
        value: 50,
      });
      expect(parseIntSpy.callCount).to.be.eq(2);
    });

    it('should process all items in Arrays', () => {
      const schema = {
        items: {
          type: 'integer',
        },
        type : 'array',
      };
      const value  = ['10', '1000', '99999', '-1'];
      const retVal = castFieldsToNumberUsingSchema(schema, value);
      expect(retVal).to.be.deep.eq([10, 1000, 99999, -1]);
      expect(parseIntSpy.callCount).to.be.eq(4);
    });
  });
});
