
describe('helpers/diff', () => {
  describe('merge', () => {
    it('should only add new content');
    it('should only remove already in place content');
    it('should return false if trying to remove not existing content');
    it('should return false if trying to add already added content');
  });

  describe('reverse', () => {
    it('should reverse diff output');
  });
});