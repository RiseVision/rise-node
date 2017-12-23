import { inject, injectable, postConstruct, tagged } from 'inversify';
import * as popsicle from 'popsicle';
import * as Throttle from 'promise-parallel-throttle';
import * as z_schema from 'z-schema';
import { cbToPromise, constants as constantsType, ILogger, JobsQueue, Sequence } from '../helpers/';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IAppState, IBroadcasterLogic, IPeerLogic, IPeersLogic, ITransactionLogic } from '../ioc/interfaces/logic';
import {
  IMultisignaturesModule, IPeersModule, ISystemModule, ITransactionsModule,
  ITransportModule
} from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { BasePeerType, PeerHeaders, PeerState, SignedBlockType } from '../logic/';
import { IBaseTransaction } from '../logic/transactions/';
import peersSchema from '../schema/peers';
import schema from '../schema/transport';
import { AppConfig } from '../types/genericTypes';

// tslint:disable-next-line
export type PeerRequestOptions = { api?: string, url?: string, method: 'GET' | 'POST', data?: any };

@injectable()
export class TransportModule implements ITransportModule {
  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.multisignatures)
  private multisigModule: IMultisignaturesModule;
  @inject(Symbols.modules.transactions)
  private transactionModule: ITransactionsModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // Logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: IBroadcasterLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;

  // Generics
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  // Helpers
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  private balancesSequence: Sequence;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;

  private loaded: boolean = false;

  @postConstruct()
  public postConstructor() {
    this.appState.setComputed('node.poorConsensus', (a: IAppState) => {
      if (typeof(a.get('node.consensus')) === 'undefined') {
        return false;
      }
      return a.get('node.consensus') < this.constants.minBroadhashConsensus;
    });
  }

  // tslint:disable-next-line max-line-length
  public async getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }> {
    let url = options.url;
    if (options.api) {
      url = `/peer${options.api}`;
    }
    const thePeer = this.peersLogic.create(peer);
    const req     = {
      body   : null,
      headers: this.systemModule.headers,
      method : options.method,
      timeout: this.appConfig.peers.options.timeout,
      url    : `http://${peer.ip}:${peer.port}${url}`,
    };

    if (options.data) {
      req.body = options.data;
    }

    const res = await popsicle.request(req)
      .use(popsicle.plugins.parse(['json'], false));

    if (res.status !== 200) {
      this.removePeer({ peer: thePeer, code: `ERESPONSE ${res.status}` }, `${req.method} ${req.url}`);
      return Promise.reject(new Error(`Received bad response code ${res.status} ${res.method} ${res.url}`));
    }

    const headers: PeerHeaders = thePeer.applyHeaders(res.headers);
    if (!this.schema.validate(headers, schema.headers)) {
      this.removePeer({ peer: thePeer, code: 'EHEADERS' }, `${req.method} ${req.url}`);
      return Promise.reject(new Error(`Invalid response headers ${JSON.stringify(headers)} ${req.method} ${req.url}`));
    }

    if (!this.systemModule.networkCompatible(headers.nethash)) {
      this.removePeer({ peer: thePeer, code: 'ENETHASH' }, `${req.method} ${req.url}`);
      return Promise.reject(new Error(`Peer is not on the same network ${headers.nethash} ${req.method} ${req.url}`));
    }

    if (!this.systemModule.versionCompatible(headers.version)) {
      this.removePeer({ peer: thePeer, code: `EVERSION ${headers.version}` }, `${req.method} ${req.url}`);
      // tslint:disable-next-line max-line-length
      return Promise.reject(new Error(`Peer is using incompatible version ${headers.version} ${req.method} ${req.url}`));
    }

    this.peersModule.update(thePeer);
    return {
      body: res.body,
      peer: thePeer,
    };
  }

  // tslint:disable-next-line max-line-length
  public async getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }, options: PeerRequestOptions) {
    config.limit         = 1;
    config.allowedStates = [PeerState.CONNECTED, PeerState.DISCONNECTED];
    const { peers }      = await this.peersModule.list(config);
    return this.getFromPeer<T>(peers[0], options);
  }

  public cleanup() {
    this.loaded = false;
    return Promise.resolve();
  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  public async onPeersReady() {
    this.logger.trace('Peers ready');
    // await this.discoverPeers();
    JobsQueue.register('peersDiscoveryAndUpdate', async () => {
      try {
        await this.discoverPeers();
      } catch (err) {
        this.logger.error('Discovering new peers failed', err);
      }

      const peers = this.peersLogic.list(false);
      this.logger.trace('Updating peers', { count: peers.length });

      await Throttle.all(peers.map((p) => async () => {
        if (p && p.state !== PeerState.BANNED && (!p.updated || Date.now() - p.updated > 3000)) {
          this.logger.trace('Updating peer', p.string);
          try {
            await p.pingAndUpdate();
          } catch (err) {
            this.logger.debug(`Ping failed when updating peer ${p.string}`);
          }
        }
      }), {maxInProgress: 50});
      this.logger.trace('Updated Peers');
    }, 5000);
  }

  /**
   * Calls enqueue signatures and emits a signature change socket message
   * TODO: Eventually fixme
   */
  public onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean) {
    if (broadcast && !this.broadcasterLogic.maxRelays(signature)) {
      this.broadcasterLogic.enqueue({}, { api: '/signatures', data: { signature }, method: 'POST' });
      this.io.sockets.emit('signature/change', signature);
    }
  }

  /**
   * Calls enqueue if broadcast is true and did not exhaust relays
   * Be aware that the transaction object is modified by adding relays: number
   * TODO: Eventually fixme
   */
  public onUnconfirmedTransaction(transaction: IBaseTransaction<any> & { relays?: number }, broadcast: boolean) {
    if (broadcast && !this.broadcasterLogic.maxRelays(transaction)) {
      this.broadcasterLogic.enqueue({}, { api: '/transactions', data: { transaction }, method: 'POST' });
      this.io.sockets.emit('transactions/change', transaction);
    }
  }

  /**
   * On new block get current broadhash, update system (to calc new broadhash) and broadcast block to all
   * peers on old broadhash.
   * Be aware that original block will be modified by adding relays if not there.
   * TODO: eventually fixme ^^
   */
  public async onNewBlock(block: SignedBlockType & { relays?: number }, broadcast: boolean) {
    if (broadcast) {
      const broadhash = this.systemModule.broadhash;

      await this.systemModule.update();
      if (!this.broadcasterLogic.maxRelays(block)) {
        await this.broadcasterLogic.broadcast({ limit: this.constants.maxPeers, broadhash },
          { api: '/blocks', data: { block }, method: 'POST', immediate: true });
      }
      this.io.sockets.emit('blocks/change', block);
    }
  }

  @ValidateSchema()
  public async receiveSignatures(@SchemaValid(schema.signature, 'Invalid signatures body')
                                   // tslint:disable-next-line max-line-length
                                   query: { signatures: Array<{ transaction: string, signature: string }> }): Promise<void> {
    const { signatures } = query;
    for (const signature of signatures) {
      try {
        await this.receiveSignature(signature);
      } catch (err) {
        this.logger.debug(err, signature);
      }
    }
  }

  /**
   * Validate signature with schema and calls processSignature from module multisignautre
   */
  @ValidateSchema()
  public async receiveSignature(@SchemaValid(schema.signature, 'Invalid signature body')
                                  signature: { transaction: string, signature: string }): Promise<void> {
    try {
      await this.multisigModule.processSignature(signature);
    } catch (e) {
      throw new Error(`Error processing signature: ${e.message || e}`);
    }
  }

  @ValidateSchema()
  public async receiveTransactions(@SchemaValid(schema.transactions, 'Invalid transactions body')
                                     query: { transactions: Array<IBaseTransaction<any>> },
                                   peer: IPeerLogic,
                                   extraLogMessage: string) {
    for (const tx of  query.transactions) {
      try {
        await this.receiveTransaction(tx, peer, true, extraLogMessage);
      } catch (err) {
        this.logger.debug(err, tx);
      }
    }
  }

  /**
   * Checks tx is ok by normalizing it and eventually remove peer if tx is not valid
   * calls processUnconfirmedTransaction over it.
   * @returns {Promise<void>}
   */
  // tslint:disable-next-line max-line-length
  public async receiveTransaction(transaction: IBaseTransaction<any>, peer: IPeerLogic, bundled: boolean, extraLogMessage: string): Promise<string> {
    try {
      transaction = this.transactionLogic.objectNormalize(transaction);
    } catch (e) {
      this.logger.debug('Transaction normalization failed', {
        err   : e.toString(),
        id    : transaction.id,
        module: 'transport',
        tx    : transaction,
      });
      this.removePeer({ peer, code: 'ETRANSACTION' }, extraLogMessage);
      throw new Error(`Invalid transaction body ${e.message}`);
    }

    try {
      await this.balancesSequence.addAndPromise(async () => {
        this.logger.debug(`Received transaction ${transaction.id} from peer: ${peer.string}`);
        await this.transactionModule.processUnconfirmedTransaction(
          transaction,
          true,
          bundled
        );
      });
      return transaction.id;
    } catch (err) {
      this.logger.debug(`Transaction ${transaction.id} error ${err}`, transaction);
      throw new Error(err);
    }
  }

  /**
   * Removes a peer by calling modules peer remove
   */
  private removePeer(options: { code: string, peer: IPeerLogic }, extraMessage: string) {
    this.logger.debug(`${options.code} Removing peer ${options.peer.string} ${extraMessage}`);
    this.peersModule.remove(options.peer.ip, options.peer.port);
  }

  /**
   * Discover peers by getting list and validates them
   */
  private async discoverPeers(): Promise<void> {
    this.logger.trace('Transport->discoverPeers');
    const response = await this.getFromRandomPeer<any>(
      {},
      {
        api   : '/list',
        method: 'GET',
      }
    );

    await cbToPromise((cb) => this.schema.validate(response.body, peersSchema.discover.peers, cb));

    // Filter only acceptable peers.
    const acceptablePeers = this.peersLogic.acceptable(response.body.peers);

    let discovered   = 0;
    let alreadyKnown = 0;
    let rejected     = 0;
    for (const rawPeer of acceptablePeers) {
      const peer: IPeerLogic = this.peersLogic.create(rawPeer);
      if (this.schema.validate(peer, peersSchema.discover.peer)) {
        peer.state   = PeerState.DISCONNECTED;
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

    this.logger.debug(`Discovered ${discovered} peers - Rejected ${rejected} - AlreadyKnown ${alreadyKnown}`);

  }
}
