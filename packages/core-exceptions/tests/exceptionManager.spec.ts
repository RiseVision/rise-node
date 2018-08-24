import * as chai from 'chai';
import { ExceptionsManager } from '../src';

const { expect } = chai;

const getTestHandler = () => {
  return {
    canHandle() {
      return true;
    },
    handle() {
      return true;
    },
  };
};
const exceptionType  = Symbol('tests');

describe('helpers/exceptionManager', () => {
  describe('registerExceptionHandler', () => {
    it('should add only one handler for a unique handlerKey to the handlers array', () => {
      const excManager = new ExceptionsManager();
      for (let i = 0; i < 3; i++) {
        const handler = getTestHandler();
        // We use the same handlerKey for each handler
        excManager.registerExceptionHandler(exceptionType, 'sameKey', handler);
      }
      expect(excManager.handlersForKey(exceptionType).length).to.be.eq(1);
    });
  });

  describe('handlersForKey', () => {
    it('should return an array of handlers for the passed exception type', () => {
      const expectedHandlers = [];
      const excManager       = new ExceptionsManager();
      for (let i = 0; i < 3; i++) {
        const handler = getTestHandler();
        expectedHandlers.push(handler);
        // This time we use a different key for each handler
        excManager.registerExceptionHandler(exceptionType, 'test_' + i, handler);
      }
      expect(excManager.handlersForKey(exceptionType)).to.be.deep.eq(expectedHandlers);
    });

    it('should return an empty array if no handler for exception type exists', () => {
      const excManager = new ExceptionsManager();
      expect(excManager.handlersForKey(exceptionType)).to.be.deep.eq([]);
    });
  });
});
