import { expect } from 'chai';
import { Diff } from '../../src/diff';
// tslint:disable no-string-literal no-unused-expression

describe('helpers/diff', () => {
  describe('merge', () => {
    it('should only add new content', () => {
      expect(Diff.merge(['b'], ['+a'])).to.be.deep.eq(['b', 'a']);
    });
    it('should only remove already in place content', () => {
      expect(Diff.merge(['b', 'a'], ['-a'])).to.be.deep.eq(['b']);
    });
    it('should return false if trying to remove not existing content', () => {
      expect(Diff.merge(['b'], ['-a'])).to.be.deep.eq(false);
    });
    it('should return false if trying to add already added content', () => {
      expect(Diff.merge(['b'], ['+b'])).to.be.deep.eq(false);
    });
    it('should handle null source', () => {
      expect(Diff.merge(null, ['+b']))
        .to.be.deep.eq(['b']);
    });
    it('shouldnt modify original array', () => {
      const arr     = ['a', 'b', 'c'];
      const arrCopy = ['a', 'b', 'c'];
      Diff.merge(arr, ['-a', '-b', '+d']);
      expect(arr).to.be.deep.eq(arrCopy);
    });
    it('should return null if all elements gets removed', () => {
      expect(Diff.merge(['a', 'b'], ['-a', '-b'])).to.be.null;
    });
  });

  describe('reverse', () => {
    it('should reverse diff', () => {
      expect(Diff.reverse(['-a', '+b', '-c', '+d'])).to.be.deep.eq(['+a', '-b', '+c', '-d']);
    });
    it('should return empty array if empty arr is given', () => {
      expect(Diff.reverse([])).to.be.deep.eq([]);
    });
  });
});
