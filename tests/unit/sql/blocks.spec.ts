import * as chai from 'chai';
import blocks from '../../../src/sql/blocks';
const expect = chai.expect;

// tslint:disable no-unused-expression
describe('sql/blocks', () => {
  let result: string;

  describe('countList()', () => {
    it('With WHERE', () => {
      result = blocks.countList({where: ['p1=1', 'p2=2']});
      expect(result).to.equal('SELECT COUNT("b_id")::int FROM blocks_list WHERE p1=1 AND p2=2');
    });

    it('Without WHERE', () => {
      result = blocks.countList({where: []});
      expect(result).to.equal('SELECT COALESCE((SELECT height FROM blocks ORDER BY height DESC LIMIT 1), 0)');
    });
  });

  describe('aggregateBlocksReward()', () => {
    it('With start', () => {
      result = blocks.aggregateBlocksReward({start: 123});
      // tslint:disable max-line-length
      expect(result).to.equal('WITH delegate AS (SELECT 1 FROM mem_accounts m WHERE m."isDelegate" = 1 AND m."publicKey" = DECODE(${generatorPublicKey}, \'hex\') LIMIT 1), rewards AS (SELECT COUNT(1) AS count, SUM(reward) AS rewards FROM blocks WHERE "generatorPublicKey" = DECODE(${generatorPublicKey}, \'hex\')  AND timestamp >= ${start} ), fees AS (SELECT SUM(fees) AS fees FROM rounds_fees WHERE "publicKey" = DECODE(${generatorPublicKey}, \'hex\')  AND timestamp >= ${start} ) SELECT (SELECT * FROM delegate) AS delegate, (SELECT count FROM rewards) AS count, (SELECT fees FROM fees) AS fees, (SELECT rewards FROM rewards) AS rewards');
    });

    it('With end', () => {
      result = blocks.aggregateBlocksReward({end: 123});
      // tslint:disable max-line-length
      expect(result).to.equal('WITH delegate AS (SELECT 1 FROM mem_accounts m WHERE m."isDelegate" = 1 AND m."publicKey" = DECODE(${generatorPublicKey}, \'hex\') LIMIT 1), rewards AS (SELECT COUNT(1) AS count, SUM(reward) AS rewards FROM blocks WHERE "generatorPublicKey" = DECODE(${generatorPublicKey}, \'hex\')  AND timestamp <= ${end} ), fees AS (SELECT SUM(fees) AS fees FROM rounds_fees WHERE "publicKey" = DECODE(${generatorPublicKey}, \'hex\')  AND timestamp <= ${end} ) SELECT (SELECT * FROM delegate) AS delegate, (SELECT count FROM rewards) AS count, (SELECT fees FROM fees) AS fees, (SELECT rewards FROM rewards) AS rewards');
    });

    it('Without start & end', () => {
      result = blocks.aggregateBlocksReward({});
      // tslint:disable max-line-length
      expect(result).to.equal('WITH delegate AS (SELECT 1 FROM mem_accounts m WHERE m."isDelegate" = 1 AND m."publicKey" = DECODE(${generatorPublicKey}, \'hex\') LIMIT 1), rewards AS (SELECT COUNT(1) AS count, SUM(reward) AS rewards FROM blocks WHERE "generatorPublicKey" = DECODE(${generatorPublicKey}, \'hex\') ), fees AS (SELECT SUM(fees) AS fees FROM rounds_fees WHERE "publicKey" = DECODE(${generatorPublicKey}, \'hex\') ) SELECT (SELECT * FROM delegate) AS delegate, (SELECT count FROM rewards) AS count, (SELECT fees FROM fees) AS fees, (SELECT rewards FROM rewards) AS rewards');
    });
  });

  describe('list()', () => {
    it('With WHERE', () => {
      result = blocks.list({where: ['f1=1', 'f2=2']});
      expect(result).to.equal('SELECT * FROM blocks_list WHERE f1=1 AND f2=2 LIMIT ${limit} OFFSET ${offset}');
    });

    it('Without WHERE', () => {
      result = blocks.list({where: []});
      expect(result).to.equal('SELECT * FROM blocks_list LIMIT ${limit} OFFSET ${offset}');
    });

    it('With sortField', () => {
      result = blocks.list({where: [], sortField: 'f1', sortMethod: 'ASC'});
      expect(result).to.equal('SELECT * FROM blocks_list ORDER BY f1 ASC LIMIT ${limit} OFFSET ${offset}');
    });
  });

  describe('getCommonBlock()', () => {
    it('With previousBlock', () => {
      result = blocks.getCommonBlock({previousBlock: 'abc'});
      expect(result).to.equal('SELECT COUNT("id")::int FROM blocks WHERE "id" = ${id} AND "previousBlock" = ${previousBlock} AND "height" = ${height}');
    });

    it('Without previousBlock', () => {
      result = blocks.getCommonBlock({previousBlock: ''});
      expect(result).to.equal('SELECT COUNT("id")::int FROM blocks WHERE "id" = ${id} AND "height" = ${height}');
    });
  });

  describe('loadBlocksData()', () => {
    it('With id and lastId', () => {
      result = blocks.loadBlocksData({id: 'aaa', lastId: 'bbb'});
      expect(result).to.equal('SELECT * FROM full_blocks_list WHERE "b_id" = ${id}  AND  "b_height" > ${height} AND "b_height" < ${limit} ORDER BY "b_height", "t_rowId"');
    });

    it('Without id and lastId', () => {
      result = blocks.loadBlocksData({});
      expect(result).to.equal('SELECT * FROM full_blocks_list WHERE "b_height" < ${limit} ORDER BY "b_height", "t_rowId"');
    });

    it('Without id', () => {
      result = blocks.loadBlocksData({id: 'aaa'});
      expect(result).to.equal('SELECT * FROM full_blocks_list WHERE "b_id" = ${id} ORDER BY "b_height", "t_rowId"');
    });

    it('Without lastId', () => {
      result = blocks.loadBlocksData({lastId: 'bbb'});
      expect(result).to.equal('SELECT * FROM full_blocks_list WHERE "b_height" > ${height} AND "b_height" < ${limit} ORDER BY "b_height", "t_rowId"');
    });
  });
});
