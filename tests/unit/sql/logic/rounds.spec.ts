import * as chai from 'chai';
import rounds from '../../../../src/sql/logic/rounds';
const expect = chai.expect;

// tslint:disable no-unused-expression
describe('sql/logic/rounds', () => {
  let result: string;

  describe('updateMissedBlocks()', () => {
    it('if backwards is true', () => {
      result = rounds.updateMissedBlocks(true);
      // tslint:disable max-line-length
      expect(result).to.equal('UPDATE mem_accounts SET "missedblocks" = "missedblocks" - 1 WHERE "address" IN ($1:csv);');
    });

    it('if backwards is false', () => {
      result = rounds.updateMissedBlocks(false);
      // tslint:disable max-line-length
      expect(result).to.equal('UPDATE mem_accounts SET "missedblocks" = "missedblocks" + 1 WHERE "address" IN ($1:csv);');
    });
  });
});
