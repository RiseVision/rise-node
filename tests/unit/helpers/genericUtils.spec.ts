import {expect} from 'chai';
import { removeEmptyObjKeys } from '../../../src/helpers/genericUtils';

describe('genericUtils', () => {

  describe('removeEmptyObjKeys', () => {

    it('should remove *all* empty keys when recursive is true', () => {
      const input = {
        a: {
          aa: {
            aaa: 1,
            bbb: 1,
          },
          ab: {
            aba: {
              abaa: null,
            },
          },
        },
        b: undefined,
        d: {
          da: null,
        },
        e: null,
      };

      const output = removeEmptyObjKeys(input, true);
      expect(output).to.be.deep.equal({
        a: {
          aa: {
            aaa: 1,
            bbb: 1,
          },
          ab: {
            aba: {},
          },
        },
        d: {},
      });
    });

    it('should remove empty keys only at first level when recursive is false', () => {
      const input = {
        a: {
          aa: {
            aaa: 1,
            bbb: 1,
          },
          ab: {
            aba: {
              abaa: null,
            },
          },
        },
        b: undefined,
        d: {
          da: null,
        },
        e: null,
      };
      const output = removeEmptyObjKeys(input, false);
      expect(output).to.be.deep.eq({
        a: {
          aa: {
            aaa: 1,
            bbb: 1,
          },
          ab: {
            aba: {
              abaa: null,
            },
          },
        },
        d: {
          da: null,
        },
      });
    });

    it('should catch both null and undefined', () => {
      const output = removeEmptyObjKeys({
        a: null,
        b: undefined,
      });
      expect(output).to.be.deep.eq({});
    });
  });
});
