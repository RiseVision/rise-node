import { expect } from 'chai';
import { z_schema, TransactionType } from '../../../src/helpers';
import rawBlock from '../../../src/schema/logic/rawBlock';

const schema = new z_schema({});
describe('rawBlock JSON schema', () => {
  // tslint:disable
  let validBlockWithTX = {
    "b_id"                  : "2937216933941712415",
    "b_version"             : 0,
    "b_timestamp"           : 62570850,
    "b_height"              : 973885,
    "b_previousBlock"       : "12402032688901388011",
    "b_numberOfTransactions": 3,
    "b_totalAmount"         : "7500000000",
    "b_totalFee"            : "30000000",
    "b_reward"              : "1500000000",
    "b_payloadLength"       : 543,
    "b_payloadHash"         : "2e03f0d5f1ea299f14ccb781cf49f6eb7b990de611c9f83f2c935a27fefdcf6c",
    "b_generatorPublicKey"  : "80ef544d87ada767c24a94b57a92ce98509c552deb1040c55eac1cf598f64ff2",
    "b_blockSignature"      : "f034c541af866f3620e8afbb4011a7330f859ac6cf67b3dc0e1c64763f9bb4bb091d30c330dc1cddc44d3d4a91b791fbab95ee5010a31dff7b22f0a3971e1102",
    "t_id"                  : "13783145741149294833",
    "t_rowId"               : 375166,
    "t_type"                : 0,
    "t_timestamp"           : 62570822,
    "t_senderPublicKey"     : "c849616c03c876f4d01619c02f2a196bf0b83d5710512a0d0b57f1875a43db4d",
    "t_senderId"            : "9118592480051707047R",
    "t_recipientId"         : "249525396788145268R",
    "t_amount"              : "2600000000",
    "t_fee"                 : "10000000",
    "t_signature"           : "e8953751ca60669797f6b49209f85c19f987eb1c7d1fbdd36d1db83da2b84b34c6b4b162cad59f38fd200a64810aeca86e236b6d166089cc6a49a045b1ea8c01",
    "t_signSignature"       : "ce861e680ee4524650ee9929c385857ecf18060264286483ce479a5b5ed3c46ef6b0757341632b52456c67c17a8d1d5eab9f92f30c11fa9a8575fbec6bfc0d06",
    "s_publicKey"           : null,
    "d_username"            : null,
    "v_votes"               : null,
    "m_min"                 : null,
    "m_lifetime"            : null,
    "m_keysgroup"           : null,
    "t_requesterPublicKey"  : null,
    "t_signatures"          : null
  };

  let validBlockWithoutTX = {
    "b_id"                  : "9987745183032090296",
    "b_version"             : 0,
    "b_timestamp"           : 62570910,
    "b_height"              : 973887,
    "b_previousBlock"       : "5117732342740750468",
    "b_numberOfTransactions": 0,
    "b_totalAmount"         : "0",
    "b_totalFee"            : "0",
    "b_reward"              : "1500000000",
    "b_payloadLength"       : 0,
    "b_payloadHash"         : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "b_generatorPublicKey"  : "70a9c5555eea50685f4c081f81e692f70416ec1a032154ded8f8e0f3ecfadab7",
    "b_blockSignature"      : "47b8288f8fa6108aa65ab76ee2ea38c833698dacd0621c0a938c686fefe235c3e87586a07514faaaac4ccca16ef3a37e0f841bcbfbeac805700424651c66c109",
    "t_id"                  : null,
    "t_rowId"               : null,
    "t_type"                : null,
    "t_timestamp"           : null,
    "t_senderPublicKey"     : null,
    "t_senderId"            : null,
    "t_recipientId"         : null,
    "t_amount"              : null,
    "t_fee"                 : null,
    "t_signature"           : null,
    "t_signSignature"       : null,
    "s_publicKey"           : null,
    "d_username"            : null,
    "v_votes"               : null,
    "m_min"                 : null,
    "m_lifetime"            : null,
    "m_keysgroup"           : null,
    "t_requesterPublicKey"  : null,
    "t_signatures"          : null
  };

  // tslint:enable
  // tslint:disable no-unused-expression

  it('should accept a block with valid SEND tx data', () => {
    const result = schema.validate(validBlockWithTX, rawBlock);
    expect(result).to.be.true;
  });

  it('should accept a block with valid SIGNATURE tx data', () => {
    const block = {... validBlockWithTX };
    block.t_type = TransactionType.SIGNATURE;
    block.s_publicKey = '70a9c5555eea50685f4c081f81e692f70416ec1a032154ded8f8e0f3ecfadab7';
    const result = schema.validate(block, rawBlock);
    expect(result).to.be.true;
  });

  it('should accept a block with valid DELEGATE tx data', () => {
    const block = {... validBlockWithTX };
    block.t_type = TransactionType.DELEGATE;
    block.d_username = 'rise_delegate';
    const result = schema.validate(block, rawBlock);
    expect(result).to.be.true;
  });

  it('should accept a block with valid VOTE tx data', () => {
    const block = {... validBlockWithTX };
    block.t_type = TransactionType.VOTE;
    block.v_votes = '-123125232342R,+236345346354R';
    const result = schema.validate(block, rawBlock);
    expect(result).to.be.true;
  });

  it('should accept a block with valid MULTI tx data', () => {
    const block = {... validBlockWithTX };
    block.t_type = TransactionType.MULTI;
    block.m_min = 2;
    block.m_lifetime = 8640000000;
    block.m_keysgroup = '70a9c5555eea50685f4c081f81e692f70416ec1a032154ded8f8e0f3ecfadab7,' +
                        '032154ded8f8e0f3ecfadab770a9c5555eea50685f4c081f81e692f70416ec1a';
    const result = schema.validate(block, rawBlock);
    expect(result).to.be.true;
  });

  it('should accept a block with null tx data', () => {
    const result = schema.validate(validBlockWithoutTX, rawBlock);
    expect(result).to.be.true;
  });

  describe('block with wrong data types', () => {
    // tslint:disable
    //All fields have an invalid data type, we will test each of them
    const badBlock = {
      "b_id"                  : "abc",
      "b_version"             : 'version',
      "b_timestamp"           : -1,
      "b_height"              : null,
      "b_previousBlock"       : "none",
      "b_numberOfTransactions": "12",
      "b_totalAmount"         : 10000000,
      "b_totalFee"            : "-1",
      "b_reward"              : -1000000,
      "b_payloadLength"       : -1,
      "b_payloadHash"         : "hash",
      "b_generatorPublicKey"  : "Z09c5555eea50685f4c081f81e692f70416ec1a032154ded8f8e0f3ecfadab",
      "b_blockSignature"      : true,
      "t_id"                  : 5,
      "t_type"                : "SEND",
      "t_timestamp"           : "-1",
      "t_senderPublicKey"     : "ae123567",
      "t_senderId"            : "123142352341235235L",
      "t_recipientId"         : "123142352341235235",
      "t_amount"              : 100,
      "t_fee"                 : 23450,
      "t_signature"           : "-1111",
      "t_signSignature"       : "e3b0c44298f",
      "s_publicKey"           : 123,
      "d_username"            : 'àèìòù',
      "v_votes"               : '-123142352341235235R,+123142352341235235',
      "m_min"                 : "5",
      "m_lifetime"            : -1,
      "m_keysgroup"           : "",
      "t_requesterPublicKey"  : "false",
      "t_signatures"          : ""
    };

    // tslint:enable
    // tslint:disable no-unused-expression
    Object.keys(badBlock).forEach((key) => {
      it('should reject ' + key + ' with a value of ' + JSON.stringify(badBlock[key]), () => {
        const block = { ... validBlockWithTX };
        block[key] = badBlock[key];
        expect(schema.validate(block, rawBlock)).to.be.false;
      });
    });
  });

  it('should reject block not including each required element', () => {
    ['b_id', 'b_blockSignature', 'b_generatorPublicKey', 'b_height',
      'b_numberOfTransactions', 'b_payloadHash', 'b_payloadLength', 'b_previousBlock', 'b_timestamp',
      'b_totalAmount', 'b_totalFee', 'b_reward', 'b_version', 't_id', 't_type', 't_timestamp',
      't_senderPublicKey', 't_requesterPublicKey', 't_senderId', 't_recipientId', 't_signature',
      't_signSignature',
    ].forEach((el) => {
      const block = { ... validBlockWithTX };
      delete block[el];
      expect(schema.validate(block, rawBlock)).to.be.false;
    });
  });
});
