import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import {ILogger} from '../../logger';

export default function initHTTPAPI(transactionsModule, app: Application, logger: ILogger, cache) {

  const router = Router();

  // attach a middleware to endpoints
  router.attachMiddlwareForUrls(
    httpApi.middleware.useCache.bind(null, logger, cache),
    ['get /']
  );

  router.map(transactionsModule.shared, {
    'get /'                   : 'getTransactions',
    'get /count'              : 'getTransactionsCount',
    'get /get'                : 'getTransaction',
    'get /multisignatures'    : 'getMultisignatureTransactions',
    'get /multisignatures/get': 'getMultisignatureTransaction',
    'get /queued'             : 'getQueuedTransactions',
    'get /queued/get'         : 'getQueuedTransaction',
    'get /unconfirmed'        : 'getUnconfirmedTransactions',
    'get /unconfirmed/get'    : 'getUnconfirmedTransaction',
    'put /'                   : 'addTransactions',
  });

  httpApi.registerEndpoint('/api/transactions', app, router, transactionsModule.isLoaded);
}

