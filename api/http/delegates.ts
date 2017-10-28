import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import {ILogger} from '../../logger';

// TODO: Describe delegatesModule
export default function initHTTPAPI(delegatesModule, app: Application, logger: ILogger, cache: any) {

  const router = Router();

  // attach a middlware to endpoints
  router.attachMiddlwareForUrls(httpApi.middleware.useCache.bind(null, logger, cache), ['get /']);

  router.map(
    delegatesModule.shared,
    {
      'get /'                          : 'getDelegates',
      'get /count'                     : 'count',
      'get /fee'                       : 'getFee',
      'get /forging/getForgedByAccount': 'getForgedByAccount',
      'get /get'                       : 'getDelegate',
      'get /getNextForgers'            : 'getNextForgers',
      'get /search'                    : 'search',
      'get /voters'                    : 'getVoters',
      'put /'                          : 'addDelegate',
    }
  );

  router.map(
    delegatesModule.internal,
    {
      'get /forging/status'  : 'forgingStatus',
      'post /forging/disable': 'forgingDisable',
      'post /forging/enable' : 'forgingEnable',
    }
  );

  if (process.env.DEBUG) {
    router.map(
      delegatesModule.internal,
      {
        'get /forging/disableAll': 'forgingDisableAll',
        'get /forging/enableAll' : 'forgingEnableAll',
      }
    );
  }

  httpApi.registerEndpoint('/api/delegates', app, router, delegatesModule.isLoaded);
}
