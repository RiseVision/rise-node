import { ModelSymbols } from '@risevision/core-models';
import {
  AppConfig,
  BasePeerType,
  IAppState,
  IBlocksModel,
  IBlocksModule,
  IJobsQueue,
  ILogger,
  ISequence,
  ISystemModule,
  ITransactionsModel,
  PeerHeaders,
  PeerRequestOptions,
  PeerState,
  PeerType,
  Symbols,
} from '@risevision/core-types';
import { cbToPromise } from '@risevision/core-utils';
import { WrapInBalanceSequence } from '@risevision/core-utils';
import { decorate, inject, injectable, named, postConstruct } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as popsicle from 'popsicle';
import * as Throttle from 'promise-parallel-throttle';
import * as promiseRetry from 'promise-retry';
import * as z_schema from 'z-schema';
import { P2PConstantsType, p2pSymbols } from './helpers';
import { OnPeersReady } from './hooks/actions';
import { PeersLogic } from './peersLogic';
import { PeersModule } from './peersModule';
import {
  ITransportMethod,
  PeersListResponse,
  SingleTransportPayload,
} from './requests/';

// tslint:disable-next-line
const peersSchema = require('../schema/peers.json');
// tslint:disable-next-line
const transportSchema = require('../schema/transport.json');

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

// tslint:disable-next-line
@injectable()
export class TransportModule extends Extendable {
  // Generics
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  // Helpers
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.balancesSequence)
  public balancesSequence: ISequence;
  @inject(p2pSymbols.constants)
  private p2pConstants: P2PConstantsType;
  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.peers)
  private peersLogic: PeersLogic;

  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: PeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  // models
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  @inject(p2pSymbols.transportMethod)
  @named(p2pSymbols.requests.peersList)
  private peersListMethod: ITransportMethod<any, any, any>;

  @inject(p2pSymbols.transportMethod)
  @named(p2pSymbols.requests.ping)
  private pingRequest: ITransportMethod<any, any, any>;

  private loaded: boolean = false;

  @postConstruct()
  public postConstructor() {
    this.appState.setComputed('node.poorConsensus', (a: IAppState) => {
      if (typeof a.get('node.consensus') === 'undefined') {
        return false;
      }
      return a.get('node.consensus') < this.p2pConstants.minBroadhashConsensus;
    });
  }

  // tslint:disable-next-line max-line-length
  public async getFromPeer<T>(
    peer: BasePeerType,
    options: PeerRequestOptions
  ): Promise<{ body: T; peer: PeerType }> {
    const url = options.url;
    const thePeer = this.peersLogic.create(peer);
    const req = {
      body: options.data,
      headers: {
        ...(this.systemModule.headers as any),
        accept: 'application/octet-stream',
        'content-type': 'application/octet-stream',
        ...options.headers,
      },
      method: options.method,
      timeout: this.appConfig.peers.options.timeout,
      transport: popsicle.createTransport({ type: 'buffer' }),
      url: `http://${peer.ip}:${peer.port}${url}`,
    };

    const parsingPlugin = (
      request: popsicle.Request,
      next: () => Promise<popsicle.Response>
    ) => {
      return next().then((response) => response);
    };

    let res: popsicle.Response;
    try {
      res = await promiseRetry(
        (retry) =>
          popsicle
            .request(req)
            .use(parsingPlugin)
            .catch(retry),
        {
          minTimeout: 2000 /* this is the timeout for the retry. Lets wait at least 2seconds before retrying. */,
          retries: 1,
        }
      );
    } catch (err) {
      this.removePeer(
        { peer: thePeer, code: 'HTTPERROR' },
        `${err.message} - When requesting ${options.url}`
      );
      return Promise.reject(err);
    }

    if (res.status !== 200) {
      this.removePeer(
        { peer: thePeer, code: `ERESPONSE ${res.status}` },
        `${req.method} ${req.url}`
      );
      return Promise.reject(
        new Error(
          `Received bad response code ${res.status} ${req.method} ${res.url}`
        )
      );
    }

    if (!this.schema.validate(res.headers as any, transportSchema.headers)) {
      this.removePeer(
        { peer: thePeer, code: 'EHEADERS' },
        `${req.method} ${req.url}`
      );
      return Promise.reject(
        new Error(
          `Invalid response headers ${JSON.stringify(res.headers)} ${
            req.method
          } ${req.url}`
        )
      );
    }

    const headers: PeerHeaders = thePeer.applyHeaders(res.headers as any);
    if (!this.systemModule.networkCompatible(headers.nethash)) {
      this.removePeer(
        { peer: thePeer, code: 'ENETHASH' },
        `${req.method} ${req.url}`
      );
      return Promise.reject(
        new Error(
          `Peer is not on the same network ${headers.nethash} ${req.method} ${
            req.url
          }`
        )
      );
    }

    if (!this.systemModule.versionCompatible(headers.version)) {
      this.removePeer(
        { peer: thePeer, code: `EVERSION ${headers.version}` },
        `${req.method} ${req.url}`
      );
      // tslint:disable-next-line max-line-length
      return Promise.reject(
        new Error(
          `Peer is using incompatible version ${headers.version} ${
            req.method
          } ${req.url}`
        )
      );
    }
    this.peersModule.update(thePeer);
    return {
      body: res.body,
      peer: thePeer,
    };
  }

  // tslint:disable-next-line max-line-length
  public async getFromRandomPeer<Body, Query, Out>(
    config: { limit?: number; broadhash?: string; allowedStates?: PeerState[] },
    transportMethod: ITransportMethod<Body, Query, Out>,
    payload: SingleTransportPayload<Body, Query> | null
  ): Promise<Out | null> {
    config.limit = 1;
    config.allowedStates = [PeerState.CONNECTED, PeerState.DISCONNECTED];
    const peers = this.peersModule.getPeers(config);
    if (peers.length === 0) {
      throw new Error('No peers available');
    }
    return peers[0].makeRequest(transportMethod, payload || undefined);
  }

  public cleanup() {
    this.loaded = false;
    this.jobsQueue.unregister('peersDiscoveryAndUpdate');
    return Promise.resolve();
  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  @OnPeersReady()
  public async onPeersReady() {
    this.logger.trace('Peers ready');
    // await this.discoverPeers();
    this.jobsQueue.register(
      'peersDiscoveryAndUpdate',
      async () => {
        try {
          await this.discoverPeers();
        } catch (err) {
          this.logger.error('Discovering new peers failed', err);
        }

        const peers = this.peersLogic.list(false);
        this.logger.trace('Updating peers', { count: peers.length });

        await Throttle.all(
          peers.map((p) => async () => {
            if (
              p &&
              p.state !== PeerState.BANNED &&
              (!p.updated || Date.now() - p.updated > 3000)
            ) {
              this.logger.trace('Updating peer', p.string);
              try {
                await p.makeRequest(this.pingRequest);
              } catch (err) {
                this.logger.debug(
                  `Ping failed when updating peer ${p.string}`,
                  err
                );
              }
            }
          }),
          { maxInProgress: 50 }
        );
        this.logger.trace('Updated Peers');
      },
      5000
    );
  }

  /**
   * Removes a peer by calling modules peer remove
   */
  private removePeer(
    options: { code: string; peer: PeerType },
    extraMessage: string
  ) {
    this.logger.debug(
      `${options.code} Removing peer ${options.peer.string} ${extraMessage}`
    );
    this.peersModule.remove(options.peer.ip, options.peer.port);
  }

  /**
   * Discover peers by getting list and validates them
   */
  @WrapInBalanceSequence
  private async discoverPeers(): Promise<void> {
    this.logger.trace('Transport->discoverPeers');

    const response = await this.getFromRandomPeer<
      void,
      void,
      PeersListResponse
    >({}, this.peersListMethod, null);

    if (!response) {
      this.logger.debug('discoverPeers failed');
    }

    await cbToPromise((cb) =>
      this.schema.validate(response, peersSchema.discover.peers, cb)
    );

    // Filter only acceptable peers.
    const acceptablePeers = this.peersLogic.acceptable(response!.peers);

    let discovered = 0;
    let alreadyKnown = 0;
    let rejected = 0;
    for (const rawPeer of acceptablePeers) {
      const peer = this.peersLogic.create(rawPeer);
      if (this.schema.validate(peer, peersSchema.discover.peer)) {
        peer.state = PeerState.DISCONNECTED;
        const newOne = this.peersLogic.upsert(peer, true);
        if (newOne) {
          discovered++;
        } else {
          alreadyKnown++;
        }
      } else {
        this.logger.warn(`Rejecting invalid peer: ${peer.string}`);
        rejected++;
      }
    }

    this.logger.debug(
      `Discovered ${discovered} peers - Rejected ${rejected} - AlreadyKnown ${alreadyKnown}`
    );
  }
}
