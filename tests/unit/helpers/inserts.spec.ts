import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { Inserts } from '../../../src/helpers/inserts';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/inserts', () => {
  let sandbox: SinonSandbox;
  let instance: any;
  let result: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('constructor()', () => {
    it('Case 1: Invalid record argument', () => {
      expect(() => new Inserts(undefined, true, true)).to.throw(
        'Invalid record argument'
      );
    });

    it('Case 2: Invalid record argument', () => {
      expect(
        () =>
          new Inserts(
            {
              fields: ['f1', 'f2', 'f3'],
              table: undefined,
              values: ['v1', 'v2', 'v3'],
            },
            true,
            true
          )
      ).to.throw('Invalid record argument');
    });

    it('Case 3: Invalid record argument', () => {
      expect(
        () =>
          new Inserts(
            { table: 'abc', values: undefined, fields: ['f1', 'f2', 'f3'] },
            true,
            true
          )
      ).to.throw('Invalid record argument');
    });

    it('Invalid value argument', () => {
      expect(
        () =>
          new Inserts(
            {
              fields: ['f1', 'f2', 'f3'],
              table: 'abc',
              values: ['v1', 'v2', 'v3'],
            },
            undefined,
            true
          )
      ).to.throw('Invalid value argument');
    });
  });

  describe('namedTemplate()', () => {
    it('success', () => {
      instance = new Inserts(
        {
          fields: ['f1', 'f2', 'f3'],
          table: 'abc',
          values: ['v1', 'v2', 'v3'],
        },
        456,
        false
      );
      result = instance.namedTemplate();
      expect(result).to.equal('${f1},${f2},${f3}');
    });

    it('If empty fields', () => {
      instance = new Inserts(
        { table: 'abc', values: ['v1', 'v2', 'v3'], fields: [] },
        456,
        false
      );
      result = instance.namedTemplate();
      expect(result).to.equal('');
    });
  });

  describe('_template()', () => {
    it('success', () => {
      instance = new Inserts(
        {
          fields: ['f1', 'f2', 'f3'],
          table: 'abc',
          values: ['v1', 'v2', 'v3'],
        },
        456,
        false
      );
      result = instance._template;
      expect(result).to.equal('${f1},${f2},${f3}');
    });
  });

  describe('template()', () => {
    it('if concat is TRUE', () => {
      instance = new Inserts(
        {
          fields: ['f1', 'f2', 'f3'],
          table: 'abc',
          values: ['v1', 'v2', 'v3'],
        },
        456,
        true
      );
      result = instance.template();
      expect(result).to.equal('INSERT INTO "abc" ("f1","f2","f3") VALUES $1^');
    });

    it('if concat is FALSE', () => {
      instance = new Inserts(
        {
          fields: ['f1', 'f2', 'f3'],
          table: 'abc',
          values: ['v1', 'v2', 'v3'],
        },
        456,
        false
      );
      result = instance.template();
      expect(result).to.equal(
        'INSERT INTO "abc" ("f1","f2","f3") VALUES (${f1},${f2},${f3})'
      );
    });
  });

  describe('toPostgres()', () => {
    it('success', () => {
      instance = new Inserts(
        {
          fields: ['f1', 'f2', 'f3'],
          table: 'abc',
          values: ['v1', 'v2', 'v3'],
        },
        [1, 2, 3],
        false
      );
      result = instance.toPostgres();
      expect(result).to.equal(
        '(${f1},${f2},${f3}),(${f1},${f2},${f3}),(${f1},${f2},${f3})'
      );
    });
  });
});
