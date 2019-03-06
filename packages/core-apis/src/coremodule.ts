import { AppConfig, BaseCoreModule, Symbols } from '@risevision/core-types';
import { cbToPromise } from '@risevision/core-utils';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import { Application } from 'express';
import * as http from 'http';
import {
  useContainer as useContainerForHTTP,
  useExpressServer,
} from 'routing-controllers';
import { APIConfig, APISymbols, limitsMiddleware, middleware } from './helpers';
import { SocketIOAPI } from './socketio';
import {
  APIErrorHandler,
  APISuccessInterceptor,
  PrivateApisGuard,
} from './utils';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = require('../schema/config.json');
  public constants = {};
  private srv: http.Server;

  public addElementsToContainer() {
    const app = express();
    this.srv = http.createServer(app);

    this.container.bind(APISymbols.express).toConstantValue(app);

    this.container
      .bind(APISymbols.middleware)
      .toConstructor(APIErrorHandler)
      .whenTargetNamed(APISymbols.errorHandler);

    this.container
      .bind(APISymbols.class)
      .to(APISuccessInterceptor)
      .inSingletonScope()
      .whenTargetNamed(APISymbols.successInterceptor);
    this.container
      .bind(APISymbols.class)
      .to(PrivateApisGuard)
      .inSingletonScope()
      .whenTargetNamed(APISymbols.privateApiGuard);
    this.container
      .bind(APISymbols.class)
      .toConstantValue(limitsMiddleware)
      .whenTargetNamed(APISymbols.applyLimitsMiddleware);

    this.container
      .bind(APISymbols.socketIOAPI)
      .to(SocketIOAPI)
      .inSingletonScope();
  }

  public async initAppElements() {
    const app = this.container.get<Application>(APISymbols.express);
    await this.container.get<SocketIOAPI>(APISymbols.socketIOAPI).hookMethods();
    app.use(compression({ level: 9 }));
    app.use(cors());
    app.options('*', cors());

    app.use(bodyParser.raw({ limit: '2mb' }));
    app.use(
      bodyParser.urlencoded({
        extended: true,
        limit: '2mb',
        parameterLimit: 5000,
      })
    );
    app.use(bodyParser.json({ limit: '2mb' }));
    app.use(
      middleware.logClientConnections(
        this.container.get(Symbols.helpers.logger)
      )
    );
    // Disallow inclusion in iframe.
    app.use(middleware.attachResponseHeader('X-Frame-Options', 'DENY'));
    /* Set Content-Security-Policy headers.
     *
     * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
     *
     * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
     */
    app.use(
      middleware.attachResponseHeader(
        'Content-Security-Policy',
        "frame-ancestors 'none'"
      )
    );

    useContainerForHTTP({
      get: (clz: any) => {
        const symbol = Reflect.getMetadata(Symbols.class, clz);
        if (symbol == null) {
          throw new Error(`ERROR instantiating for HTTP ${clz}`);
        }
        try {
          return this.container.getNamed(APISymbols.class, symbol);
        } catch (e) {
          return this.container.getNamed(APISymbols.middleware, symbol);
        }
      },
    });

    let controllers: any[] = [];
    try {
      controllers = this.container.getAll<any>(APISymbols.api);
    } catch (e) {
      // Amen
      // tslint:disable-next-line
      console.log(e);
    }
    let middlewares: any[] = [];
    try {
      middlewares = this.container.getAll<any>(APISymbols.middleware);
    } catch (e) {
      // Amen
      // tslint:disable-next-line
      console.log(e);
    }

    // initialize controllers and middlewares to get IoC support here.
    controllers.concat(middlewares).forEach((el) => {
      this.container
        .bind(APISymbols.class)
        .to(el)
        .inSingletonScope()
        .whenTargetNamed(Reflect.getMetadata(Symbols.class, el));
    });

    useExpressServer(app, {
      controllers,
      defaultErrorHandler: false,
      middlewares,
    });
  }

  public async teardown() {
    await this.container.get<SocketIOAPI>(APISymbols.socketIOAPI).unHook();
    return cbToPromise((cb) => this.srv.close(cb)).catch((e) => void 0);
  }

  public async boot() {
    const appConfig = this.container.get<APIConfig>(Symbols.generic.appConfig);

    await cbToPromise((cb) =>
      this.srv.listen(
        appConfig.api.port,
        appConfig.api.address || appConfig.address,
        cb
      )
    );
  }
}
