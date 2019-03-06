import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSpy } from 'sinon';
import { castFieldsToNumberUsingSchema } from '../../src';

// tslint:disable no-unused-expression no-big-function object-literal-sort-keys no-identical-functions

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
    const value = '10000';
    const retVal = castFieldsToNumberUsingSchema(schema, value);
    expect(retVal).to.be.deep.eq(value);
  });

  it('should parse "integer" schema values to radix 10 integer', () => {
    const schema = { type: 'integer' };
    const value = '10000';
    const retVal = castFieldsToNumberUsingSchema(schema, value);
    expect(parseIntSpy.called).to.be.true;
    expect(retVal).to.be.eq(10000);
    expect(retVal).to.not.be.eq(value);
  });

  it('should not try to cast undefined', () => {
    const schema = { type: 'integer' };
    const value = undefined;
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
          type: 'object',
        },
        value: {
          type: 'integer',
        },
      },
      type: 'object',
    };
    const value = {
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
      type: 'array',
    };
    const value = ['10', '1000', '99999', '-1'];
    const retVal = castFieldsToNumberUsingSchema(schema, value);
    expect(retVal).to.be.deep.eq([10, 1000, 99999, -1]);
    expect(parseIntSpy.callCount).to.be.eq(4);
  });
});
