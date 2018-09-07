import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants, middleware, P2pConfig, p2pSymbols, ProtoBufHelper } from './helpers';
import { CommanderStatic } from 'commander';
import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

import * as compression from 'compression';
import * as cors from 'cors';
import { Application } from 'express';
import { useContainer as useContainerForHTTP, useExpressServer } from 'routing-controllers';
import * as socketIO from 'socket.io';
import { Symbols } from '@risevision/core-interfaces';
import { cbToPromise } from '@risevision/core-utils';
import { ModelSymbols } from '@risevision/core-models';
import { PeersModel } from './PeersModel';
import { PeersAPI } from './api/peersAPI';
import { PeersLogic } from './peersLogic';
import { PeersModule } from './peersModule';
import { PeerLogic } from './peer';
import { BasePeerType } from '@risevision/core-types';
import { TransportModule } from './transport';
import { BroadcasterLogic } from './broadcaster';
import {
  HeightRequest,
  PeersListRequest
} from './requests';
import { requestFactory } from './utils/';
import { TransportV2API } from './api/transportv2API';
import { AttachPeerHeaders, ValidatePeerHeaders } from './api/middlewares';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<P2pConfig> {
  public constants    = constants;
  public configSchema = configSchema;
  private srv: http.Server;

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

  public initAppElements() {
    const app = this.container.get<Application>(p2pSymbols.express);
    if (this.config.peers.trustProxy) {
      app.enable('trust proxy');
    }
    app.use(compression({ level: 9 }));
    app.use(cors());
    app.options('*', cors());

    app.use(bodyParser.raw({ limit: '2mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
    app.use(bodyParser.json({ limit: '2mb' }));
    app.use(middleware.logClientConnections(this.container.get(Symbols.helpers.logger)));
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
        get: (clz: any) => {
          const symbol = Reflect.getMetadata(Symbols.class, clz);
          if (symbol == null) {
            throw new Error(`ERROR instantiating for HTTP ${clz}`);
          }
          return this.container
            .getNamed(Symbols.class, clz);
        },
      }
    );
    useExpressServer(
      app,
      {
        controllers        : this.container.getAll<any>(p2pSymbols.controller),
        defaultErrorHandler: false,
        middlewares        : this.container.getAll<any>(p2pSymbols.middleware),
      }
    );

  }

  public addElementsToContainer(): void {
    const app = express();
    this.srv = http.createServer(app);
    this.container.bind(p2pSymbols.constants).toConstantValue(this.constants);
    this.container.bind(p2pSymbols.controller).to(TransportV2API).inSingletonScope().whenTargetNamed(p2pSymbols.api.transportV2);
    this.container.bind(p2pSymbols.controller).to(PeersAPI).inSingletonScope().whenTargetNamed(p2pSymbols.api.peersAPI);
    this.container.bind(p2pSymbols.express).toConstantValue(app);
    this.container.bind(p2pSymbols.server).toConstantValue(this.srv);
    this.container.bind(ModelSymbols.model)
      .toConstructor(PeersModel)
      .whenTargetNamed(p2pSymbols.model);

    this.container.bind(p2pSymbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();
    this.container.bind(p2pSymbols.logic.peerLogic).to(PeerLogic).inSingletonScope();
    this.container.bind(p2pSymbols.logic.peersLogic).to(PeersLogic).inSingletonScope();
    this.container.bind(p2pSymbols.logic.peerFactory).toFactory((ctx) => {
      return (peer: BasePeerType) => {
        const p = ctx.container.get<PeerLogic>(Symbols.logic.peer);
        p.accept({ ... {}, ...peer });
        return p;
      };
    });
    this.container.bind(p2pSymbols.modules.peers).to(PeersModule).inSingletonScope();
    this.container.bind(p2pSymbols.modules.transport).to(TransportModule).inSingletonScope();
    this.container.bind(p2pSymbols.socketIO).toConstantValue(socketIO(this.srv));
    this.container.bind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelper);

    // Request factories.
    this.container.bind(p2pSymbols.requests.height).toFactory(requestFactory(HeightRequest));
    this.container.bind(p2pSymbols.requests.peersList).toFactory(requestFactory(PeersListRequest));

    // APIs
    this.container.bind(p2pSymbols.api.attachPeerHeaders)
      .to(AttachPeerHeaders)
      .inSingletonScope();
    this.container.bind(p2pSymbols.api.validatePeerHeadersMiddleware)
      .to(ValidatePeerHeaders)
      .inSingletonScope();
    this.container.bind(p2pSymbols.api.transportV2)
      .to(ValidatePeerHeaders)
      .inSingletonScope();

  }

  public teardown(): Promise<void> {
    this.container.get<BroadcasterLogic>(p2pSymbols.logic.broadcaster).cleanup();
    this.container.get<TransportModule>(p2pSymbols.modules.transport).cleanup();
    return cbToPromise((cb) => this.srv.close(cb))
      .catch((e) => void 0);
  }

  public boot(): Promise<void> {
    const appConfig = this.container.get<P2pConfig>(Symbols.generic.appConfig);
    return cbToPromise((cb) => this.srv.listen(appConfig.port, appConfig.address, cb));
  }
}
