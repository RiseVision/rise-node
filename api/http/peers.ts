import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';

// TODO: Describe peersModule
export default function initHTTPAPI(peersModule, app: Application) {

  const router = Router();

  router.map(peersModule.shared, {
    'get /'       : 'getPeers',
    'get /count'  : 'count',
    'get /get'    : 'getPeer',
    'get /version': 'version',
  });

  httpApi.registerEndpoint('/api/peers', app, router, peersModule.isLoaded);
}
