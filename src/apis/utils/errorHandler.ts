import express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressErrorMiddlewareInterface, Middleware } from 'routing-controllers';
import { ILogger } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { Symbols } from '../../ioc/symbols';

@Middleware({ type: 'after' })
@IoCSymbol(Symbols.api.utils.errorHandler)
@injectable()
export class APIErrorHandler implements ExpressErrorMiddlewareInterface {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  public error(error: any, req: express.Request, res: express.Response, next: (err: any) => any) {
    if (error instanceof Error) {
      error = error.message;
    }
    this.logger.error('API error ' + req.url, error);
    res.status(500)
      .send({ success: false, error });
    next({ success: false, error });
  }

}
