import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import {ILogger} from '../../logger';

export default function initHTTPAPI(blocksModule, app: Application, logger: ILogger, cache) {
  const router = Router();

  // attach a middlware to endpoints
  router.attachMiddlwareForUrls(
    httpApi.middleware.useCache.bind(null, logger, cache),
    [ 'get /' ]
  );

  router.map(blocksModule.shared, {
    'get /'            : 'getBlocks',
    'get /get'         : 'getBlock',
    'get /getBroadhash': 'getBroadhash',
    'get /getEpoch'    : 'getEpoch',
    'get /getFee'      : 'getFee',
    'get /getFees'     : 'getFees',
    'get /getHeight'   : 'getHeight',
    'get /getMilestone': 'getMilestone',
    'get /getNethash'  : 'getNethash',
    'get /getReward'   : 'getReward',
    'get /getStatus'   : 'getStatus',
    'get /getSupply'   : 'getSupply',
  });

  httpApi.registerEndpoint('/api/blocks', app, router, blocksModule.isLoaded);
}
