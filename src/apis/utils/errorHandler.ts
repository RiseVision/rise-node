import express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressErrorMiddlewareInterface, Middleware } from 'routing-controllers';
import { ILogger, ProtoBufHelper } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { Symbols } from '../../ioc/symbols';
import { APIError } from '../errors';

@Middleware({ type: 'after' })
@IoCSymbol(Symbols.api.utils.errorHandler)
@injectable()
export class APIErrorHandler implements ExpressErrorMiddlewareInterface {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  public error(error: any, req: express.Request, res: express.Response, next: (err: any) => any) {
    if (req.url.startsWith('/v2')) {
      return next(error);
    }
    if (error instanceof APIError) {
      res.status(error.statusCode);
    } else {
      res.status(200);
    }
    if (error instanceof Error) {
      error = error.message;
    }
    if (req.url.startsWith('/peer') || req.url.startsWith('/v2/peer')) {
      this.logger.warn(`Transport error [${req.ip}]: ${req.url}`, error);
    } else {
      this.logger.error('API error ' + req.url, error);
    }
    res.send({ success: false, error });
  }

}
