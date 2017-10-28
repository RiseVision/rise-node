import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import schema from '../../schema/dapps';

// TODO add dappsModule type definition here
export default function initHTTPAPI(dappsModule, app: Application) {

  const router = Router();

  router.map(dappsModule.internal, {
    'get /categories'             : 'categories',
    'get /installed'              : 'installed',
    'get /installedIds'           : 'installedIds',
    'get /installing'             : 'installing',
    'get /ismasterpasswordenabled': 'isMasterPasswordEnabled',
    'get /launched'               : 'launched',
    'get /uninstalling'           : 'uninstalling',
    'post /launch'                : 'launch',
    'put /transaction'            : 'addTransactions',
    'put /withdrawal'             : 'sendWithdrawal',
  });

  router.get('/', httpApi.middleware.sanitize('query', schema.list, dappsModule.internal.list));
  router.put('/', httpApi.middleware.sanitize('body', schema.put, dappsModule.internal.put));
  router.get('/get', httpApi.middleware.sanitize('query', schema.get, dappsModule.internal.get));
  router.get('/search', httpApi.middleware.sanitize('query', schema.search, dappsModule.internal.search));
  router.post('/install', httpApi.middleware.sanitize('body', schema.install, dappsModule.internal.install));
  router.post('/uninstall', httpApi.middleware.sanitize('body', schema.uninstall, dappsModule.internal.uninstall));
  router.post('/stop', httpApi.middleware.sanitize('body', schema.stop, dappsModule.internal.stop));

  httpApi.registerEndpoint('/api/dapps', app, router, dappsModule.isLoaded);
}
