import { ILogger, Symbols } from '@risevision/core-interfaces';
import express from 'express';
import { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { inject, injectable, multiInject, postConstruct } from 'inversify';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { p2pSymbols, ProtoBufHelper } from '../helpers';
import { BaseTransportMethod } from '../requests/BaseTransportMethod';

@injectable()
export class TransportAPI {
  @multiInject(p2pSymbols.transportMethod)
  private transportMethods: Array<BaseTransportMethod<any, any, any>>;

  @inject(p2pSymbols.express)
  private express: Application;

  @multiInject(p2pSymbols.transportMiddleware)
  private transportMiddlewares: ExpressMiddlewareInterface[];

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  @postConstruct()
  public postConstruct() {
    const router = express.Router();

    // install transport routes..
    this.transportMethods.forEach((tm) => {
      const handles: RequestHandler[] = [

        // Install middlewares
        ... this.transportMiddlewares
          .map((m) => m.use.bind(m)),

        // Real work.
        async (req: Request, res: Response, next: NextFunction) => {
          res.set('content-type', 'application/octet-stream');
          const resp = await tm.requestHandler(req.body, req.query);
          return tm.wrapResponse({error: false, wrappedResponse: resp});
        },

        // Error handler
        this.handleError(tm),
      ];

      router[tm.method === 'GET' ? 'get' : 'post'](
        tm.baseUrl,
        handles
      );
    });

    // install router.
    this.express.use(router);
  }

  private handleError(tm: BaseTransportMethod<any, any, any>) {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
      let message = err;
      if (message instanceof Error) {
        message = message.message;
      }
      res.set('content-type', 'application/octet-stream');
      res.send(tm.wrapResponse({ error: true, message})).end();
    };
  }
}
