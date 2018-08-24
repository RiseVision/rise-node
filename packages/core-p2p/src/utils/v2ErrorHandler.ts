import { ILogger, Symbols } from '@risevision/core-interfaces';
import { IoCSymbol } from '@risevision/core-utils';
import express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressErrorMiddlewareInterface, Middleware } from 'routing-controllers';
import { p2pSymbols, ProtoBufHelper } from '../helpers';

@Middleware({ type: 'after' })
@IoCSymbol(p2pSymbols.utils.v2ErrorHandler)
@injectable()
export class V2APIErrorHandler implements ExpressErrorMiddlewareInterface {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(p2pSymbols.helpers.protoBuf)
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
