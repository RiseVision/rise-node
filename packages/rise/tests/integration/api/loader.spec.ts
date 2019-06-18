import {
  BlocksConstantsType,
  BlocksModule,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { ITimeToEpoch, Symbols } from '@risevision/core-types';
import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/loader/status', () => {
  initializer.setup();

  describe('/sync', () => {
    checkReturnObjKeyVal(
      'broadhash',
      '16985986483000875063',
      '/api/loader/status/sync'
    );
    checkReturnObjKeyVal('height', 1, '/api/loader/status/sync');
    checkReturnObjKeyVal('syncing', false, '/api/loader/status/sync');
    checkReturnObjKeyVal('isStale', true, '/api/loader/status/sync');
    it('should return success true if lastblock is within staleAgeThreshold', async () => {
      const blocksModule = initializer.appManager.container.get<BlocksModule>(
        Symbols.modules.blocks
      );
      const consts = initializer.appManager.container.get<BlocksConstantsType>(
        BlocksSymbols.constants
      );
      const timeToEpoch = initializer.appManager.container.get<ITimeToEpoch>(
        Symbols.helpers.timeToEpoch
      );
      await initializer.rawMineBlocks(1);
      consts.staleAgeThreshold =
        60 +
        Math.floor(Date.now() / 1000) -
        (timeToEpoch.getTime() + blocksModule.lastBlock.timestamp);
      return supertest(initializer.apiExpress)
        .get('/api/loader/status/sync')
        .expect(200)
        .then((response) => {
          expect(response.body.isStale).is.false;
          consts.staleAgeThreshold = 45;
        });
    });
  });

  describe('/ping', () => {
    // cause last block is too old
    checkReturnObjKeyVal('success', true, '/api/loader/status/ping');
  });
});
