import * as chai from 'chai';
import transactions from '../../../../src/sql/logic/transactions';
const expect = chai.expect;

// tslint:disable no-unused-expression
describe('sql/logic/rounds', () => {
  let result: string;

  describe('countList()', () => {
    it('With WHERE', () => {
      result = transactions.countList({where: ['p1=1', 'AND', 'p2=2']});
      expect(result).to.equal('SELECT COUNT(1) FROM trs_list WHERE (p1=1 AND p2=2)');
    });

    it('Without WHERE', () => {
      result = transactions.countList({where: []});
      expect(result).to.equal('SELECT COUNT(1) FROM trs_list');
    });
  });

  describe('list()', () => {
    it('With WHERE', () => {
      result = transactions.list({where: ['p1=1', 'AND', 'p2=2']});
      // tslint:disable max-line-length
      expect(result).to.equal('SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId", "t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations", ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey" FROM trs_list WHERE (p1=1 AND p2=2) LIMIT ${limit} OFFSET ${offset}');
    });

    it('Without WHERE', () => {
      result = transactions.list({where: []});
      // tslint:disable max-line-length
      expect(result).to.equal('SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId", "t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations", ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey" FROM trs_list LIMIT ${limit} OFFSET ${offset}');
    });

    it('With sortField', () => {
      result = transactions.list({where: [], sortField: 'f1', sortMethod: 'ASC'});
      // tslint:disable max-line-length
      expect(result).to.equal('SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId", "t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations", ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey" FROM trs_list ORDER BY f1 ASC LIMIT ${limit} OFFSET ${offset}');
    });

    it('With owner', () => {
      result = transactions.list({where: [], owner: true});
      // tslint:disable max-line-length
      expect(result).to.equal('SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId", "t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations", ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey" FROM trs_list WHERE LIMIT ${limit} OFFSET ${offset}');
    });
  });
});
