import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';

// TODO: describe mutlisignaturesModule
export default function initHTTPAPI(mutlisignaturesModule, app: Application) {

  const router = Router();

  router.map(
    mutlisignaturesModule.shared,
    {
      'get /accounts': 'getAccounts',
      'get /pending' : 'pending',
      'post /sign'   : 'sign',
      'put /'        : 'addMultisignature',
    }
  );

  httpApi.registerEndpoint('/api/multisignatures', app, router, mutlisignaturesModule.isLoaded);
}
