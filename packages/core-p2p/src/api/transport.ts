import { ILogger, Symbols } from '@risevision/core-interfaces';
import * as express from 'express';
import { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { inject, injectable, multiInject, postConstruct } from 'inversify';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { p2pSymbols } from '../helpers';
import { ITransportMethod } from '../requests';
import { TransportWrapper } from '../utils/TransportWrapper';

@injectable()
export class TransportAPI {
  @inject(p2pSymbols.__internals.resolvedTransportMethods)
  private transportMethods: Array<ITransportMethod<any, any, any>>;

  @inject(p2pSymbols.express)
  private express: Application;

  @inject(p2pSymbols.__internals.resolvedTransportMiddlewares)
  private transportMiddlewares: ExpressMiddlewareInterface[];

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(p2pSymbols.utils.transportWrapper)
  private transportWrapper: TransportWrapper;

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
          const resp = await tm.handleRequest(req.body, req.query);
          return this.transportWrapper
            .wrapResponse({ success: true, wrappedResponse: resp });
        },

        // Error handler
        this.handleError.bind(this),
      ];

      router[tm.method === 'GET' ? 'get' : 'post'](
        tm.baseUrl,
        handles
      );
    });

    // install router.
    this.express.use(router);
  }

  private handleError(err: any, req: Request, res: Response, next: NextFunction) {
    let message = err;
    if (message instanceof Error) {
      message = message.message;
    }
    res.set('content-type', 'application/octet-stream');
    res.send(this.transportWrapper
      .wrapResponse({ success: false, error: message as string })).end();
  }
}
