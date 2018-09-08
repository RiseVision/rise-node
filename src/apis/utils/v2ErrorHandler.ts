import express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressErrorMiddlewareInterface, Middleware } from 'routing-controllers';
import { ILogger, ProtoBufHelper } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { Symbols } from '../../ioc/symbols';
import { APIError } from '../errors';

@Middleware({ type: 'after' })
@IoCSymbol(Symbols.api.utils.v2ErrorHandler)
@injectable()
export class V2APIErrorHandler implements ExpressErrorMiddlewareInterface {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.protoBuf)
  private protoBuf: ProtoBufHelper;

  public error(error: any, req: express.Request, res: express.Response, next: (err: any) => any) {
    if (!req.url.startsWith('/v2')) {
      return next(error);
    }
    if (req.url.startsWith('/v2/peer')) {
      res.status(error.statusCode || 200);
    } else {
      res.status(error.statusCode || 500);
    }

    if (error instanceof Error) {
      error = error.message;
    }
    if (typeof(error.message) === 'string') {
      error = error.message;
    }
    res.contentType('application/octet-stream')
      .end(this.protoBuf.encode({success: false, error: error.toString()}, 'APIError'));
  }

}
