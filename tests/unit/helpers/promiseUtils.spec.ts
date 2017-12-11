import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { catchToLoggerAndRemapError, cbToPromise, logCatchRewrite, promiseToCB, wait } from '../../../src/helpers';
// tslint:disable no-unused-expression

const { expect } = chai;
chai.use(chaiAsPromised);

describe('helpers/promiseUtils', () => {

    describe('catchToLoggerAndRemapError', () => {
      const rejString = 'rejectString';
      const err = new Error('errorMessage');

      it('should return a function returning a rejecting promise with the right string', async () => {
        const st = sinon.stub();
        const fakeIlogger: any = {error: st};
        const retFun = catchToLoggerAndRemapError(rejString, fakeIlogger);
        const retPromise = retFun(err);
        await expect(retPromise).to.be.rejectedWith(rejString);
      });

      it('should log the error', async () => {
        const st = sinon.stub();
        const fakeIlogger: any = {error: st};
        const retFun = catchToLoggerAndRemapError(rejString, fakeIlogger);
        const retPromise = retFun(err);
        await expect(retPromise).to.be.rejected;
        expect(st.called).to.be.true;
        expect(st.firstCall.args[0]).to.be.deep.equal(err.stack);
      });
    });

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
        it('should call cb', async () => {
            const cb = sinon.stub();
            await  expect(promiseToCB(Promise.reject(new Error('testing')), cb)).to.be.rejected;
            expect(cb.called).is.true;
        });

        it('should pass error as first argument', async () => {
            const cb = sinon.stub();
            const promiseVal = new Error('err');
            await expect(promiseToCB(Promise.reject(promiseVal), cb)).to.be.rejectedWith(promiseVal);
            expect(cb.firstCall.args[0]).to.be.equal(promiseVal);
        });
      });
  });

    describe('cbToPromise', () => {

      it('should return a Promise', () => {
        const cb = sinon.stub();
        const retVal = cbToPromise(cb);
        expect(retVal).to.be.instanceOf(Promise);
      });

      it('should call fn passing a callback', () => {
        const cb = sinon.stub();
        // Promise's executor is called synchronously
        const p = cbToPromise(cb);
        expect(cb.called).to.be.true;
        expect(cb.firstCall.args[0]).to.be.a('function');
      });

      describe('calling callback', () => {
        it('should reject with right error when first arg is not null', async () => {
          const err = new Error('err');
          const fn = (cb) => {
            cb(err, 'arg1');
          };
          await expect(cbToPromise(fn)).to.be.rejectedWith(err);
        });

        it('should resolve with multiple arguments when multi is true', async () => {
          const testArgs = ['arg1', 'arg2'];
          const fn = (cb) => {
            cb( null, testArgs[0], testArgs[1]);
          };
          let passedArgs: any[];
          await cbToPromise(fn, true).then((...args) => {
            passedArgs = args;
          });
          expect(passedArgs[0]).to.be.deep.equal(testArgs);
        });

        it('should resolve with the first argument when multi is false', async () => {
          const testArgs = ['arg1', 'arg2'];
          const fn = (cb) => {
            cb( null, testArgs[0], testArgs[1]);
          };
          let passedArgs: any[];
          await cbToPromise(fn, false).then((...args) => {
            passedArgs = args;
          });
          expect(passedArgs[0]).to.be.deep.equal(testArgs[0]);
        });
      });
    });

    describe('logCatchRewrite', () => {

      it('should return a function', () => {
        const fakeLogger: any = {error: sinon.stub()};
        const errString = 'err';
        expect(logCatchRewrite(fakeLogger, errString)).to.be.a('function');
      });

      it('returned function should return a rejected promise and log the error', async () => {
        const st = sinon.stub();
        const fakeLogger: any = {error: st};
        const errString = 'err';
        const err = new Error(errString);
        const fn = logCatchRewrite(fakeLogger, errString);
        const promise = fn(err);
        await expect(promise).to.be.rejected;
        expect(st.called).to.be.true;
        expect(st.firstCall.args[0]).to.be.deep.equal(err.stack);
      });
    });

    describe('wait', () => {

      it('should resolve promise after given ms', async () => {
        const msToWait = 20;
        const timeStart = Date.now();
        await expect(wait(msToWait)).to.be.fulfilled;
        const timeEnd = Date.now();
        expect(timeEnd - timeStart).to.be.greaterThan(msToWait - 1);
      });
    });
});
