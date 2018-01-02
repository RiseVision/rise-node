import * as chai from 'chai';
import { SinonSpy } from 'sinon';
import * as sinon from 'sinon';
import { ExceptionsManager } from '../../../../src/helpers';
import { RunThroughExceptions } from '../../../../src/helpers/decorators/exceptions';

const { expect } = chai;

describe('helpers/decorators/exceptions', () => {
  describe('RunThroughExceptions', () => {
    let handlersForKeySpy: SinonSpy;
    let sandbox;

    // Handles only strings with value === 'wrongValue';
    const mockHandlerWrongValue = {
      canHandle(obj: any, s: string) {
        return s === 'wrongValue';
      },
      handle() {
        return 'rightValue';
      },
    };

    // Handles only strings with value === '';
    const mockHandlerEmptyString = {
      canHandle(obj: any, s: string) {
        return s === '';
      },
      handle() {
        return 'something';
      },
    };

    const excManager = new ExceptionsManager();
    const excType = Symbol('TestExceptions');

    excManager.registerExceptionHandler(
      excType,
      'wrongValue',
      mockHandlerWrongValue
    );
    excManager.registerExceptionHandler(
      excType,
      'emptyString',
      mockHandlerEmptyString
    );

    const handlerSpies = {
      wrongValue: {
        canHandle: null,
        handle: null,
      },
      emptyString: {
        canHandle: null,
        handle: null,
      },
    };

    beforeEach(() => {
      sandbox = sinon.sandbox.create();
      handlerSpies.wrongValue.canHandle = sandbox.spy(mockHandlerWrongValue, 'canHandle');
      handlerSpies.wrongValue.handle = sandbox.spy(mockHandlerWrongValue, 'handle');
      handlerSpies.emptyString.canHandle = sandbox.spy(mockHandlerEmptyString, 'canHandle');
      handlerSpies.emptyString.handle = sandbox.spy(mockHandlerEmptyString, 'handle');
      handlersForKeySpy = sandbox.spy(excManager, 'handlersForKey');
    });

    afterEach(() => {
      sandbox.restore();
    });

    class TestClass {
      public excManager: ExceptionsManager;
      private spy: SinonSpy;
      constructor(withSpy?: SinonSpy) {
        this.excManager = excManager;
        if (withSpy) {
          this.spy = withSpy;
        }
      }
      // We are testing a simple function decoratedFn with RunThroughExceptions
      @RunThroughExceptions(excType)
      public decoratedFn(value: string, secondArg?: boolean): string {
        if (this.spy) {
          // Pass the spy arguments as a flat array
          this.spy(Array.prototype.slice.call(arguments));
        }
        return 'orig_' + value;
      }
    }

    it('should call adequate ExceptionsManager.handlersForKey to obtain possible exceptions', () => {
      const test = new TestClass();
      test.decoratedFn('val');
      expect(handlersForKeySpy.called).to.be.true;
    });

    it('should call canHandle on all ExceptionHandlers when value is not an exception', () => {
      const test = new TestClass();
      test.decoratedFn('notAnException');
      expect(handlerSpies.wrongValue.canHandle.called && handlerSpies.emptyString.canHandle.called).to.be.true;
    });

    it('should call handle when value passed to the decoratedFn function is an exception', () => {
      const test = new TestClass();
      // Testing with our first exception
      test.decoratedFn('wrongValue');
      expect(handlerSpies.wrongValue.handle.called).to.be.true;
    });

    it('should return from handle() at the first canHandle = true', () => {
      const test = new TestClass();
      // Testing with our second exception (emptyString)
      const retVal = test.decoratedFn('');
      expect(handlerSpies.emptyString.handle.firstCall.returnValue).to.be.eq(retVal);
    });

    it('should call the original function with all arguments when no suitable handler is found', () => {
      const argsSpy = sinon.spy();
      const test = new TestClass(argsSpy);
      const retVal = test.decoratedFn('validVal', true);
      expect(argsSpy.called).to.be.true;
      expect(argsSpy.firstCall.args[0]).to.be.deep.eq(['validVal', true]);
    });

    it('should NOT call the original function when a suitable handler is found', () => {
      const argsSpy = sinon.spy();
      const test = new TestClass(argsSpy);
      // Testing with our second exception (emptyString)
      const retVal = test.decoratedFn('', true);
      expect(argsSpy.called).to.be.false;
    });
  });
});
