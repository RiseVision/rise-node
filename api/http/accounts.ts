import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import schema from '../../schema/accounts';

// TODO add accountsModule type definition here
export default function initHTTPAPI(accountsModule, app: Application) {

  const router = Router();

  router.map(
    accountsModule.shared,
    {
      'get /'                  : 'getAccount',
      'get /delegates'         : 'getDelegates',
      'get /delegates/fee'     : 'getDelegatesFee',
      'get /getBalance'        : 'getBalance',
      'get /getPublicKey'      : 'getPublickey',
      'post /generatePublicKey': 'generatePublicKey',
      'post /open'             : 'open',
      'put /delegates'         : 'addDelegates',
    }
  );

  router.map(
    accountsModule.internal,
    { 'get /count': 'count' }
  );

  if (process.env.DEBUG && process.env.DEBUG.toUpperCase() === 'TRUE') {
    router.map(accountsModule.internal, { 'get /getAllAccounts': 'getAllAccounts' });
  }

  if (process.env.TOP && process.env.TOP.toUpperCase() === 'TRUE') {
    router.get('/top', httpApi.middleware.sanitize('query', schema.top, accountsModule.internal.top));
  }

  httpApi.registerEndpoint('/api/accounts', app, router, accountsModule.isLoaded);
}
