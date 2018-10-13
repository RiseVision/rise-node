import { expect } from 'chai';
import * as sinon from 'sinon';
import { OrderBy } from '../../src';

// tslint:disable no-unused-expression
describe('helpers/orderBy', () => {
  it('should treat options as an empty object if another type is passed', () => {
    const retVal = OrderBy('blockId:ASC', ('desc' as any));
    expect(retVal.sortMethod).to.be.eq('ASC');
  });

  // This is possibly a bug because we don't want to end with a null sortField
  it('should treat options.sortField as null if not passed/false', () => {
    const retVal = OrderBy('', {});
    expect(retVal.sortField).to.be.null;
  });

  // This is possibly a bug because we don't want to end with a null sortMethod
  it('should treat options.sortMethod as null if not passed/false', () => {
    const retVal = OrderBy('blockId', {});
    expect(retVal.sortMethod).to.be.null;
  });

  it('should treat options.sortFields as empty array if not passed/false', () => {
    const retVal = OrderBy('blockId', {});
    // Error is returned when passed field is not whitelisted or if whitelist is empty
    expect(retVal.error).to.be.undefined;
  });

  it('should always quoteField if not passed', () => {
    const retVal = OrderBy('blockId', {});
    expect(retVal.sortField).to.be.eq('"blockId"');
  });

  it('should clean the sortField string from non word, non space characters', () => {
    const retVal = OrderBy('blockId!:ASC', {quoteField: false});
    expect(retVal.sortField).to.be.eq('blockId');
  });

  it('should set the sortMethod to DESC if the second chunk of orderBy is === desc', () => {
    const retVal = OrderBy('blockId:desc', {quoteField: false});
    expect(retVal.sortMethod).to.be.eq('DESC');
  });

  it('should prefix the field with string', () => {
    const retVal = OrderBy('blockId:desc', { fieldPrefix: 'my_', quoteField: false });
    expect(retVal.sortField).to.be.eq('my_blockId');
  });

  it('should prefix the field by calling passed function', () => {
    const prefixFn = (s: string ) => s.length + '_' + s;
    const spy = sinon.spy(prefixFn);
    const retVal = OrderBy('blockId:desc', { fieldPrefix: spy, quoteField: false });
    expect(retVal.sortField).to.be.eq('7_blockId');
    expect(spy.called).to.be.true;
  });

  it('should check the options.sortFields whitelist to make sure the sortField is valid', () => {
    const retVal = OrderBy('blockId', { sortFields: [ 'txId' ] });
    expect(retVal.error).to.match(/Invalid/);
  });

  it('should consider options.sortMethod only when not passed inside first parameter', () => {
    const retValPassed = OrderBy('blockId:desc', { sortMethod: 'ASC' });
    const retValNotPassed = OrderBy('blockId', { sortMethod: 'ASC' });
    expect(retValPassed.sortMethod).to.be.eq('DESC');
    expect(retValNotPassed.sortMethod).to.be.eq('ASC');
  });

  it('should quote the field', () => {
    const retVal = OrderBy('blockId', {quoteField: true});
    const retVal2 = OrderBy('blockId', {});
    expect(retVal.sortField).to.be.eq('"blockId"');
    expect(retVal2.sortField).to.be.eq('"blockId"');
  });

  it('should not quote the field if options.quoteField is false', () => {
    const retVal = OrderBy('blockId', {quoteField: false});
    expect(retVal.sortField).to.be.eq('blockId');
  });

  it('should accept the sortField when options.sortFields whitelist is empty', () => {
    const retVal = OrderBy('blockId', {sortFields: [], quoteField: false});
    expect(retVal.sortField).to.be.eq('blockId');
  });
});
