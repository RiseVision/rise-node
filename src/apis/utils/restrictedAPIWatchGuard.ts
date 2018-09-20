import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { checkIpInList } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { Symbols } from '../../ioc/symbols';
import { AppConfig } from '../../types/genericTypes';
import { APIError } from '../errors';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(Symbols.api.utils.restrictedWhiteList)
export class RestrictedAPIWatchGuard implements ExpressMiddlewareInterface {

  @inject(Symbols.generic.appConfig)
  private config: AppConfig;

  public use(request: express.Request, response: any, next: (err?: any) => any) {
    if (!checkIpInList(this.config.api.restrictedWhiteList, request.ip)) {
      return next(new APIError('Secure API access denied', 403));
    }
    next();
  }

}
