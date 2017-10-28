import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';

/**
 * Binds api with modules and creates common url.
 */
// TODO: describe signaturesModule
export default function initHTTPAPI(signaturesModule, app: Application) {

  const router = Router();

  router.map(
    signaturesModule.shared,
    {
      'get /fee': 'getFee',
      'put /'   : 'addSignature',
    }
  );

  httpApi.registerEndpoint('/api/signatures', app, router, signaturesModule.isLoaded);
}
