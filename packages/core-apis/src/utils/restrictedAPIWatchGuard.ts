import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { checkIpInList, HTTPError, IoCSymbol } from '@risevision/core-utils';
import { APIConfig, APISymbols } from '../helpers';
import { Symbols } from '@risevision/core-interfaces';

@injectable()
@IoCSymbol(APISymbols.restrictedAPIWatchGuard)
export class RestrictedAPIWatchGuard implements ExpressMiddlewareInterface {

  @inject(Symbols.generic.appConfig)
  private config: APIConfig;

  public use(request: express.Request, response: any, next: (err?: any) => any) {
    if (!checkIpInList(this.config.api.access.restrictedWhiteList, request.ip)) {
      return next(new HTTPError('Secure API access denied', 403));
    }
    next();
  }

}
