import initializer from '../common/init';
import { checkReturnObjKeyVal } from './utils';
import { Symbols } from '../../../src/ioc/symbols';
import * as supertest from 'supertest';
import { expect } from "chai";
import { BlocksModule, LoaderModule } from '../../../src/modules';
import constants from '../../../src/helpers/constants';

// tslint:disable no-unused-expression max-line-length
describe('api/loader/status', () => {

  initializer.setup();

  describe('/', () => {
    checkReturnObjKeyVal('loaded', true, '/api/loader/status');
    it('should return loaded false if blockchain is not ready', async () => {
      const loaderModule = initializer.appManager.container.get<LoaderModule>(Symbols.modules.loader);
      await loaderModule.cleanup();
      return supertest(initializer.appManager.expressApp)
        .get('/api/loader/status')
        .expect(200)
        .then((response) => {
          expect(response.body.loaded).is.false;
          loaderModule.onBlockchainReady();
        });
    });
  });

  describe('/sync', () => {
    checkReturnObjKeyVal('broadhash', 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6', '/api/loader/status/sync');
    checkReturnObjKeyVal('height', 1, '/api/loader/status/sync');
    checkReturnObjKeyVal('syncing', false, '/api/loader/status/sync');
  });

  describe('/ping', () => {
    // cause last block is too old
    checkReturnObjKeyVal('success', false, '/api/loader/status/ping');
    it('should return success true if lastblock is within blockReceiptTimeOut', async () => {
      const blocksModule = initializer.appManager.container.get<BlocksModule>(Symbols.modules.blocks);
      const consts = initializer.appManager.container.get<typeof constants>(Symbols.helpers.constants);
      await initializer.rawMineBlocks(1);
      consts.blockReceiptTimeOut = 60 + Math.floor(Date.now() / 1000) -
        (Math.floor(consts.epochTime.getTime() / 1000) + blocksModule.lastBlock.timestamp);
      return supertest(initializer.appManager.expressApp)
        .get('/api/loader/status/ping')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          consts.blockReceiptTimeOut = 60;
        });
    });
  });

});
