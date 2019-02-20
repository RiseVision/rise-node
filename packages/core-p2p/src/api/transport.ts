import { ILogger, Symbols } from '@risevision/core-types';
import * as express from 'express';
import {
  Application,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import { inject, injectable, postConstruct } from 'inversify';
import { p2pSymbols } from '../helpers';
import { ITransportMiddleware } from '../interfaces/ITransportMiddleware';
import { Peer } from '../peer';
import { ITransportMethod } from '../requests';
import { TransportWrapper } from '../utils/TransportWrapper';

@injectable()
export class TransportAPI {
  @inject(p2pSymbols.__internals.resolvedTransportMethods)
  private transportMethods: Array<ITransportMethod<any, any, any>>;

  @inject(p2pSymbols.express)
  private express: Application;

  @inject(p2pSymbols.__internals.resolvedTransportMiddlewares)
  private transportMiddlewares: ITransportMiddleware[];

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
        // Install before middlewares
        ...this.transportMiddlewares
          .filter((m) => m.when === 'before')
          .map((m) => m.use.bind(m)),

        // Real work.
        async (
          req: Request & { peer: Peer },
          res: Response,
          next: NextFunction
        ) => {
          try {
            const resp = await tm.handleRequest({
              body: req.body,
              query: req.query,
              requester: req.peer,
            });
            const wrappedResp = await this.transportWrapper.wrapResponse(
              {
                success: true,
                wrappedResponse: resp,
              },
              req.peer
            );
            res
              .set('content-type', 'application/octet-stream')
              .send(wrappedResp);
          } catch (e) {
            next(e);
          }
        },

        // Install after middlewares
        ...this.transportMiddlewares
          .filter((m) => m.when === 'after')
          .map((m) => m.use.bind(m)),

        // Error handler
        this.handleError.bind(this),
      ];

      router[tm.method === 'GET' ? 'get' : 'post'](tm.baseUrl, handles);
    });

    // install router.
    this.express.use(router);
  }

  private handleError(
    err: any,
    req: Request & { peer: Peer },
    res: Response,
    next: NextFunction
  ) {
    let message = err;
    if (message instanceof Error) {
      message = message.message;
    }
    res.set('content-type', 'application/octet-stream');
    this.transportWrapper
      .wrapResponse({ success: false, error: message as string }, req.peer)
      .then((r) => res.send(r));
  }
}
