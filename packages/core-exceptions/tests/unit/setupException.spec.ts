import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  ExceptionsManager,
  setupExceptionOnInstance,
  setupExceptionOnType,
} from '../../src';
// tslint:disable no-unused-expression no-big-function max-classes-per-file
describe('setupException', () => {
  let excManager: ExceptionsManager;

  function createHandle(canHandle: boolean, toRet: any) {
    const handler = {
      canHandle() {
        return null;
      },
      handle() {
        return null;
      },
    };
    const canHandleStub = sinon.stub(handler, 'canHandle').returns(canHandle);
    const handleStub = sinon.stub(handler, 'handle').returns(toRet);

    return {
      ...handler,
      canHandleStub,
      handleStub,
    };
  }

  beforeEach(() => {
    excManager = new ExceptionsManager();
  });

  describe('setupExceptionOnType', () => {
    it('should set up an exception', () => {
      const stub = sinon.stub().returns('a');

      class A {
        public method() {
          return stub();
        }
      }

      setupExceptionOnType(excManager, A, 'method', Symbol.for('ciao'));
      const handler = createHandle(true, 'meow');
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'h1', handler);
      const a = new A();
      expect(a.method()).eq('meow');
      expect(handler.canHandleStub.calledOnce).true;
      expect(handler.handleStub.calledOnce).true;
      expect(stub.calledOnce).false;
    });
    it('should allow multiple handlers for same key and keep FIFO order.', () => {
      const stub = sinon.stub().returns('a');
      class A {
        public method() {
          return stub();
        }
      }
      setupExceptionOnType(excManager, A, 'method', Symbol.for('ciao'));

      const handler1 = createHandle(false, 'meow');
      const handler2 = createHandle(false, 'ciao');

      excManager.registerExceptionHandler(Symbol.for('ciao'), 'one', handler1);
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'two', handler2);

      const stubs = [
        handler1.handleStub,
        handler1.canHandleStub,
        handler2.handleStub,
        handler2.canHandleStub,
        stub,
      ];

      const a = new A();
      expect(a.method()).eq('a');
      expect(stub.called).is.true;

      // First handler!
      stubs.forEach((s) => s.resetHistory());

      handler1.canHandleStub.returns(true);
      expect(a.method()).eq('meow');
      expect(handler2.canHandleStub.calledOnce).is.false;
      expect(stub.calledOnce).is.false;

      // Second handler
      stubs.forEach((s) => s.resetHistory());
      handler1.canHandleStub.returns(false);
      handler2.canHandleStub.returns(true);
      expect(a.method()).eq('ciao');
      expect(handler1.canHandleStub.calledOnce).is.true;
      expect(handler2.canHandleStub.calledOnce).is.true;
      expect(stub.calledOnce).is.false;
    });

    it('should allow multiple exceptions on same method', () => {
      class A {
        public method() {
          return 'a';
        }
      }
      setupExceptionOnType(excManager, A, 'method', Symbol.for('ciao'));
      setupExceptionOnType(excManager, A, 'method', Symbol.for('2'));

      const handler1 = createHandle(true, 'ciao');
      const handler2 = createHandle(false, '2');

      excManager.registerExceptionHandler(Symbol.for('2'), '2', handler2);
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'ciao', handler1);

      const a = new A();
      expect(a.method()).eq('ciao');
      // Both have been called
      expect(handler1.canHandleStub.calledOnce).is.true;
      expect(handler2.canHandleStub.calledOnce).is.true;

      expect(handler1.canHandleStub.calledAfter(handler2.canHandleStub)).true;
    });
  });
  describe('setupExceptionOnInstance', () => {
    it('should set up an exception', () => {
      const stub = sinon.stub().returns('a');

      class A {
        public method() {
          return stub();
        }
      }

      const a = new A();
      setupExceptionOnInstance(excManager, a, 'method', Symbol.for('ciao'));

      const handler = createHandle(true, 'meow');
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'h1', handler);

      expect(a.method()).eq('meow');
      expect(handler.canHandleStub.calledOnce).true;
      expect(handler.handleStub.calledOnce).true;
      expect(stub.calledOnce).false;
    });
    it('should allow multiple handlers for same key and keep FIFO order.', () => {
      const stub = sinon.stub().returns('a');
      class A {
        public method() {
          return stub();
        }
      }
      const a = new A();
      setupExceptionOnInstance(excManager, a, 'method', Symbol.for('ciao'));

      const handler1 = createHandle(false, 'meow');
      const handler2 = createHandle(false, 'ciao');

      excManager.registerExceptionHandler(Symbol.for('ciao'), 'one', handler1);
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'two', handler2);

      const stubs = [
        handler1.handleStub,
        handler1.canHandleStub,
        handler2.handleStub,
        handler2.canHandleStub,
        stub,
      ];

      expect(a.method()).eq('a');
      expect(stub.called).is.true;

      // First handler!
      stubs.forEach((s) => s.resetHistory());

      handler1.canHandleStub.returns(true);
      expect(a.method()).eq('meow');
      expect(handler2.canHandleStub.calledOnce).is.false;
      expect(stub.calledOnce).is.false;

      // Second handler
      stubs.forEach((s) => s.resetHistory());
      handler1.canHandleStub.returns(false);
      handler2.canHandleStub.returns(true);
      expect(a.method()).eq('ciao');
      expect(handler1.canHandleStub.calledOnce).is.true;
      expect(handler2.canHandleStub.calledOnce).is.true;
      expect(stub.calledOnce).is.false;
    });

    it('should allow multiple exceptions on same method', () => {
      class A {
        public method() {
          return 'a';
        }
      }
      const a = new A();
      setupExceptionOnInstance(excManager, a, 'method', Symbol.for('ciao'));
      setupExceptionOnInstance(excManager, a, 'method', Symbol.for('2'));

      const handler1 = createHandle(true, 'ciao');
      const handler2 = createHandle(false, '2');

      excManager.registerExceptionHandler(Symbol.for('2'), '2', handler2);
      excManager.registerExceptionHandler(Symbol.for('ciao'), 'ciao', handler1);

      expect(a.method()).eq('ciao');
      // Both have been called
      expect(handler1.canHandleStub.calledOnce).is.true;
      expect(handler2.canHandleStub.calledOnce).is.true;

      expect(handler1.canHandleStub.calledAfter(handler2.canHandleStub)).true;
    });
  });
});
