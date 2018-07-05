import { checkIpInList, IoCSymbol, Symbols } from '@risevision/core-helpers';
import { AppConfig } from '@risevision/core-types';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { APIError } from '../errors';
import { APIConfig } from '../helpers/APIConfig';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(Symbols.api.utils.forgingApisWatchGuard)
export class PrivateApisGuard implements ExpressMiddlewareInterface {

  @inject(Symbols.generic.appConfig)
  private config: APIConfig;

  public use(request: express.Request, response: any, next: (err?: any) => any) {
    if (!checkIpInList(this.config.api.access.restrictedAPIwhiteList, request.ip)) {
      return next(new APIError('Private API access denied', 403));
    }
    next();
  }

}
