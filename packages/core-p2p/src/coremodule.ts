import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants, middleware, P2pConfig, p2pSymbols } from './helpers';
import { CommanderStatic } from 'commander';
import { Container } from 'inversify';
import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

import * as compression from 'compression';
import * as cors from 'cors';
import { Application } from 'express';
import { Symbols } from '@risevision/core-helpers';
import { useContainer as useContainerForHTTP, useExpressServer } from 'routing-controllers';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<P2pConfig> {
  public constants    = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('-x, --peers [peers...]', 'peers list');
  }

  public patchConfigWithCLIParams<T extends P2pConfig>(program: CommanderStatic, appConfig: T) {
    if (program.peers) {
      if (typeof (program.peers) === 'string') {
        appConfig.peers.list = program.peers.split(',')
          .map((peer) => {
            const [ip, port] = peer.split(':');
            return { ip, port: port ? parseInt(port, 10) : appConfig.port };
          });
      } else {
        appConfig.peers.list = [];
      }
    }
    return appConfig;
  }

  public initAppElements(container: Container, config: P2pConfig) {
    const app = container.get<Application>(p2pSymbols.express);
    if (config.peers.trustProxy) {
      app.enable('trust proxy');
    }
    app.use(compression({ level: 9 }));
    app.use(cors());
    app.options('*', cors());

    app.use(bodyParser.raw({ limit: '2mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
    app.use(bodyParser.json({ limit: '2mb' }));
    app.use(middleware.logClientConnections(container.get(Symbols.helpers.logger)));
    // Disallow inclusion in iframe.
    app.use(middleware.attachResponseHeader('X-Frame-Options', 'DENY'));

    /* Set Content-Security-Policy headers.
     *
     * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
     *
     * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
     */
    app.use(middleware.attachResponseHeader('Content-Security-Policy', 'frame-ancestors \'none\''));

    useContainerForHTTP({
        get(clz: any) {
          const symbol = Reflect.getMetadata(Symbols.__others.metadata.classSymbol, clz);
          if (symbol == null) {
            throw new Error(`ERROR instantiating for HTTP ${symbol}`);
          }
          return container
            .get(symbol);
        },
      }
    );
    useExpressServer(
      app,
      {
        controllers        : container.getAll<any>(p2pSymbols.controller),
        defaultErrorHandler: false,
        middlewares        : container.getAll<any>(p2pSymbols.middleware),
      }
    );

  }

  public addElementsToContainer(container: Container): void {
    const app = express();
    const srv = http.createServer(app);
    container.bind(p2pSymbols.express).toConstantValue(app);
    container.bind(p2pSymbols.server).toConstantValue(srv);
  }
}
