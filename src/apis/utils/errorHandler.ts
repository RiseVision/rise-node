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
  @inject(Symbols.helpers.protoBuf)
  private protoBuf: ProtoBufHelper;

  public error(error: any, req: express.Request, res: express.Response, next: (err: any) => any) {
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
    if (req.url.startsWith('/v2/peer')) {
      if (typeof(error.message) === 'string') {
        error = error.message;
      }
      res.contentType('application/octet-stream')
        .end(this.protoBuf.encode({success: false, error: error.toString()}, 'APIError'));
    } else {
      res.send({ success: false, error });
    }
  }

}
