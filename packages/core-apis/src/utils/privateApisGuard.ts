import { Symbols } from '@risevision/core-types';
import { checkIpInList, HTTPError, IoCSymbol } from '@risevision/core-utils';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { APIConfig, APISymbols } from '../helpers/';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(APISymbols.privateApiGuard)
export class PrivateApisGuard implements ExpressMiddlewareInterface {
  @inject(Symbols.generic.appConfig)
  private config: APIConfig;

  public use(
    request: express.Request,
    response: any,
    next: (err?: any) => any
  ) {
    if (
      !checkIpInList(this.config.api.access.restrictedWhiteList, request.ip)
    ) {
      return next(new HTTPError('Private API access denied', 403));
    }
    next();
  }
}
