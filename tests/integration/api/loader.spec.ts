import initializer from '../common/init';
import { checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/loader', () => {

  initializer.setup();

  describe('/', () => {
    checkReturnObjKeyVal('loaded', true, '/api/loader/status');
    it('should return loaded false if blockchain is not ready');
  });

  describe('/sync', () => {
    checkReturnObjKeyVal('broadhash', 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6', '/api/loader/status/sync');
    checkReturnObjKeyVal('height', 1, '/api/loader/status/sync');
    checkReturnObjKeyVal('syncing', false, '/api/loader/status/sync');
  });

  describe('/ping', () => {
    // cause last block is too old
    checkReturnObjKeyVal('success', false, '/api/loader/status/ping');

    it('should return success true if lastblock is within blockReceiptTimeOut');
  });

});
