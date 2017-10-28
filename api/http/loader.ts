import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';

// TODO: describe loadermodule
export default function initHTTPAPI(loaderModule, app: Application) {

  const router = Router();

  router.map(
    loaderModule.shared,
    {
      'get /status'     : 'status',
      'get /status/sync': 'sync',
    }
  );

  router.get(
    '/status/ping',
    (req, res) => res
      .status(loaderModule.internal.statusPing() ? 200 : 503)
      .json({ success: status })
  );

  httpApi.registerEndpoint('/api/loader', app, router, loaderModule.isLoaded);
}
