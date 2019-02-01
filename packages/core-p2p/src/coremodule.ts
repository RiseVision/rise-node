import { APISymbols, middleware } from '@risevision/core-apis';
import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { BasePeerType } from '@risevision/core-types';
import { cbToPromise } from '@risevision/core-utils';
import * as bodyParser from 'body-parser';
import { CommanderStatic } from 'commander';
import * as compression from 'compression';
import * as express from 'express';
import { Application } from 'express';
import * as http from 'http';
import {
  useContainer as useContainerForHTTP,
  useExpressServer,
} from 'routing-controllers';
import * as socketIO from 'socket.io';
import { AttachPeerHeaders, ValidatePeerHeaders } from './api/middlewares';
import { PeersAPI } from './api/peersAPI';
import { TransportAPI } from './api/transport';
import { BroadcasterLogic } from './broadcaster';
import { constants, P2pConfig, p2pSymbols, ProtoBufHelper } from './helpers';
import { PeersLoaderSubscriber } from './hooks/subscribers/load';
import { Peer } from './peer';
import { PeersLogic } from './peersLogic';
import { PeersModel } from './PeersModel';
import { PeersModule } from './peersModule';
import { PeersListRequest, PingRequest } from './requests';
import { TransportModule } from './transport';
import { TransportWrapper } from './utils/TransportWrapper';

// tslint:disable-next-line
const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<P2pConfig> {
  public constants = constants;
  public configSchema = configSchema;
  private srv: http.Server;

  public extendCommander(program: CommanderStatic): void {
    program.option('-x, --peers [peers...]', 'peers list');
  }

  public patchConfigWithCLIParams<T extends P2pConfig>(
    program: CommanderStatic,
    appConfig: T
  ) {
    if (program.peers) {
      if (typeof program.peers === 'string') {
        appConfig.peers.list = program.peers.split(',').map((peer) => {
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

    app.use(bodyParser.raw({ limit: '2mb' }));
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
  }

  public addElementsToContainer(): void {
    const app = express();
    this.srv = http.createServer(app);
    this.container.bind(p2pSymbols.constants).toConstantValue(this.constants);
    this.container
      .bind(p2pSymbols.utils.transportWrapper)
      .to(TransportWrapper)
      .inSingletonScope();
    this.container
      .bind(p2pSymbols.api.transport)
      .to(TransportAPI)
      .inSingletonScope();
    this.container
      .bind(APISymbols.api)
      .toConstructor(PeersAPI)
      .whenTargetNamed(p2pSymbols.api.peersAPI);
    this.container.bind(p2pSymbols.express).toConstantValue(app);
    this.container.bind(p2pSymbols.server).toConstantValue(this.srv);
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(PeersModel)
      .whenTargetNamed(p2pSymbols.model);

    this.container
      .bind(p2pSymbols.logic.broadcaster)
      .to(BroadcasterLogic)
      .inSingletonScope();
    this.container.bind(p2pSymbols.logic.peerLogic).to(Peer);
    this.container
      .bind(p2pSymbols.logic.peersLogic)
      .to(PeersLogic)
      .inSingletonScope();
    this.container.bind(p2pSymbols.logic.peerFactory).toFactory((ctx) => {
      return (peer: BasePeerType) => {
        const p = ctx.container.get<Peer>(Symbols.logic.peer);
        p.accept({ ...{}, ...peer });
        return p;
      };
    });
    this.container
      .bind(p2pSymbols.modules.peers)
      .to(PeersModule)
      .inSingletonScope();
    this.container
      .bind(p2pSymbols.modules.transport)
      .to(TransportModule)
      .inSingletonScope();
    this.container
      .bind(p2pSymbols.socketIO)
      .toConstantValue(socketIO(this.srv));
    this.container.bind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelper);

    // Request factories.
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(PingRequest)
      .inSingletonScope()
      .whenTargetNamed(p2pSymbols.requests.ping);
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(PeersListRequest)
      .inSingletonScope()
      .whenTargetNamed(p2pSymbols.requests.peersList);

    // API
    this.container
      .bind(p2pSymbols.transportMiddleware)
      .to(AttachPeerHeaders)
      .inSingletonScope()
      .whenTargetNamed(p2pSymbols.transportMiddlewares.attachPeerHeaders);
    this.container
      .bind(p2pSymbols.transportMiddleware)
      .to(ValidatePeerHeaders)
      .inSingletonScope()
      .whenTargetNamed(p2pSymbols.transportMiddlewares.validatePeer);

    this.container
      .bind(p2pSymbols.__internals.loadSubscriber)
      .to(PeersLoaderSubscriber);
  }

  public async teardown(): Promise<void> {
    await this.container
      .get<BroadcasterLogic>(p2pSymbols.logic.broadcaster)
      .cleanup();
    const transportModule = this.container.get<TransportModule>(
      p2pSymbols.modules.transport
    );
    await transportModule.unHook();
    await transportModule.cleanup();
    await this.container.get<PeersModule>(p2pSymbols.modules.peers).cleanup();
    await this.container
      .get<PeersLoaderSubscriber>(p2pSymbols.__internals.loadSubscriber)
      .unHook();
    return cbToPromise((cb) => this.srv.close(cb)).catch((e) => void 0);
  }

  public async boot(): Promise<void> {
    await this.container
      .get<TransportModule>(p2pSymbols.modules.transport)
      .hookMethods();
    await this.container
      .get<PeersLoaderSubscriber>(p2pSymbols.__internals.loadSubscriber)
      .hookMethods();
    const appConfig = this.container.get<P2pConfig>(Symbols.generic.appConfig);
    this.container
      .bind(p2pSymbols.__internals.resolvedTransportMethods)
      .toConstantValue(this.container.getAll(p2pSymbols.transportMethod));
    this.container
      .bind(p2pSymbols.__internals.resolvedTransportMiddlewares)
      .toConstantValue(this.container.getAll(p2pSymbols.transportMiddleware));
    // This calls postConstruct which installs all the transport routes.
    this.container.get(p2pSymbols.api.transport);
    await cbToPromise((cb) =>
      this.srv.listen(appConfig.port, appConfig.address, cb)
    );
  }
}
