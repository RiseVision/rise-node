import { expect } from 'chai';
import * as sinon from 'sinon';
import { promiseToCB, wait } from '../../../src/helpers';
// tslint:disable no-unused-expression

describe('helpers/promiseUtils', () => {
  describe('promiseToCB', () => {
    it('should return a promise', () => {
      const ret = promiseToCB(Promise.resolve());
      expect(ret).to.be.instanceof(Promise);
    });
    describe('when resolved', () => {
      it('should call cb', async () => {
        const cb = sinon.stub();
        await promiseToCB(Promise.resolve(), cb);
        expect(cb.called).is.true;
      });
      it('should pass null as first argument', async () => {
        const cb = sinon.stub();
        await promiseToCB(Promise.resolve(), cb);
        expect(cb.firstCall.args[0]).to.be.null;
      });
      it('should pass the resolved value as second argument of cb', async () => {
        const cb = sinon.stub();
        const promiseVal = 'test';
        await promiseToCB(Promise.resolve(promiseVal), cb);
        expect(cb.firstCall.args[1]).to.be.equal(promiseVal);
      });
    });
    describe('when rejected', () => {
      it('should call cb');
      it('should pass error as first argument');
    });
  });
});