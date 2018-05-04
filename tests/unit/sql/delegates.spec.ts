import * as chai from 'chai';
import blocks from '../../../src/sql/delegates';
const expect = chai.expect;

// tslint:disable no-unused-expression
describe('sql/delegates', () => {
  let result: string;

  describe('search()', () => {
    it('should return a query string with the supplied parameters: sortField, sortMethod, q and limit', () => {
      result = blocks.search({ sortField: 'p1', sortMethod: 'ASC', q: 2, limit: 10 });
      // tslint:disable max-line-length
      expect(result).to.equal('WITH supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric), delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank, m.username, m.address, ENCODE(m."publicKey", \'hex\') AS "publicKey", m.vote, m.producedblocks, m.missedblocks, ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval, (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2) END)::float AS productivity, COALESCE(v.voters_cnt, 0) AS voters_cnt, t.timestamp AS register_timestamp FROM delegates d LEFT JOIN mem_accounts m ON d.username = m.username LEFT JOIN trs t ON d."transactionId" = t.id LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", \'hex\') WHERE m."isDelegate" = 1 ORDER BY p1 ASC) SELECT * FROM delegates WHERE username LIKE \'%2%\' LIMIT 10');
    });
  });
});
