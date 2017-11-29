import * as crypto from 'crypto';
import { IDatabase } from 'pg-promise';
import * as popsicle from 'popsicle';
import * as z_schema from 'z-schema';
import { BigNum, Bus, cbToPromise, constants, ILogger, Sequence } from '../helpers/';
import {
  BasePeerType,
  BlockLogic,
  BroadcasterLogic,
  Peer,
  PeerHeaders,
  Peers,
  PeerState,
  PeerType,
  SignedBlockType,
  TransactionLogic
} from '../logic/';
import { IBaseTransaction } from '../logic/transactions/';
import schema from '../schema/transport';
import { AppConfig } from '../types/genericTypes';
import { SchemaValid, ValidateSchema } from './apis/baseAPIClass';
import { PeersModule } from './peers';
import { SystemModule } from './system';
import { TransactionsModule } from './transactions';
// import {DebugLog} from '../helpers/decorators/debugLog';

// tslint:disable-next-line
export type PeerRequestOptions = { api?: string, url?: string, method: 'GET' | 'POST', data?: any };
// tslint:disable-next-line
export type TransportLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  bus: Bus,
  schema: z_schema,
  io: SocketIO.Server,
  balancesSequence: Sequence,
  logic: {
    block: BlockLogic,
    transaction: TransactionLogic,
    peers: Peers
  },
  config: AppConfig
};

export class TransportModule {
  public schema: z_schema;
  public headers: PeerHeaders;
  public modules: { peers: PeersModule, multisignatures: any, transactions: TransactionsModule, system: SystemModule };
  private broadcaster: BroadcasterLogic;
  private loaded: boolean = false;

  constructor(public library: TransportLibrary) {
    this.broadcaster = new BroadcasterLogic({
      config: {
        broadcasts: this.library.config.broadcasts,
        forging   : {
          force: this.library.config.forging.force,
        },
      },
      logger: this.library.logger,
      logic : {
        peers       : this.library.logic.peers,
        transactions: this.library.logic.transaction,
      },
    });
    this.schema      = this.library.schema;
  }

  public get consensus() {
    return this.broadcaster.consensus;
  }

  /**
   * True or false depending if the consensus is too low
   */
  public get poorConsensus() {
    if (typeof(this.broadcaster.consensus) === 'undefined') {
      return false;
    }
    return this.broadcaster.consensus < constants.minBroadhashConsensus;
  }

  /**
   * Use broadcaster getPeers
   * @deprecated
   */
  public async getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]> {
    return this.broadcaster.getPeers(params);
  }

  // tslint:disable-next-line max-line-length
  public async getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: Peer }> {
    let url = options.url;
    if (options.api) {
      url = `/peer${options.api}`;
    }
    const thePeer = this.library.logic.peers.create(peer);
    const req     = {
      body   : null,
      headers: this.headers,
      method : options.method,
      timeout: this.library.config.peers.options.timeout,
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

    if (!this.modules.system.networkCompatible(headers.nethash)) {
      this.removePeer({ peer: thePeer, code: 'ENETHASH' }, `${req.method} ${req.url}`);
      return Promise.reject(new Error(`Peer is not on the same network ${headers.nethash} ${req.method} ${req.url}`));
    }

    if (!this.modules.system.versionCompatible(headers.version)) {
      this.removePeer({ peer: thePeer, code: `EVERSION ${headers.version}` }, `${req.method} ${req.url}`);
      // tslint:disable-next-line max-line-length
      return Promise.reject(new Error(`Peer is using incompatible version ${headers.version} ${req.method} ${req.url}`));
    }

    this.modules.peers.update(thePeer);
    return {
      body: res.body,
      peer: thePeer,
    };
  }

  // tslint:disable-next-line max-line-length
  public async getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }, options: PeerRequestOptions) {
    config.limit         = 1;
    config.allowedStates = [PeerState.CONNECTED, PeerState.DISCONNECTED];
    const { peers }      = await this.modules.peers.list(config);
    return this.getFromPeer<T>(peers[0], options);
  }

  public cleanup() {
    this.loaded = false;
    return Promise.resolve();
  }

  public onBind(modules: any) {
    this.modules = {
      // blocks         : modules.blocks,
      multisignatures: modules.multisignatures,
      // dapps          : modules.dapps,
      peers          : modules.peers,
      system         : modules.system,
      transactions   : modules.transactions,
    };

    this.headers = modules.system.headers;
    this.broadcaster.bind(
      modules.peers,
      modules.transport,
      modules.transactions
    );
  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  /**
   * Calls enqueue signatures and emits a signature change socket message
   * TODO: Eventually fixme
   */
  public onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean) {
    if (broadcast && !this.broadcaster.maxRelays(signature)) {
      this.broadcaster.enqueue({}, { api: '/signatures', data: { signature }, method: 'POST' });
      this.library.io.sockets.emit('signature/change', signature);
    }
  }

  /**
   * Calls enqueue if broadcast is true and did not exhaust relays
   * Be aware that the transaction object is modified by adding relays: number
   * TODO: Eventually fixme
   */
  public onUnconfirmedTransaction(transaction: IBaseTransaction<any> & { relays?: number }, broadcast: boolean) {
    if (broadcast && !this.broadcaster.maxRelays(transaction)) {
      this.broadcaster.enqueue({}, { api: '/transactions', data: { transaction }, method: 'POST' });
      this.library.io.sockets.emit('transactions/change', transaction);
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
      const broadhash = this.modules.system.broadhash;

      await this.modules.system.update();
      if (!this.broadcaster.maxRelays(block)) {
        await this.broadcaster.broadcast({ limit: constants.maxPeers, broadhash },
          { api: '/blocks', data: { block }, method: 'POST', immediate: true });
      }
      this.library.io.sockets.emit('blocks/change', block);
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
        this.library.logger.debug(err, signature);
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
      await cbToPromise((cb) => this.modules.multisignatures.processSignature(signature));
    } catch (e) {
      throw new Error(`Error processing signature: ${e.message || e}`);
    }
  }

  @ValidateSchema()
  public async receiveTransactions(@SchemaValid(schema.transactions, 'Invalid transactions body')
                                     query: { transactions: any[] },
                                   peer: Peer,
                                   extraLogMessage: string) {
    for (const tx of  query.transactions) {
      try {
        await this.receiveTransaction(tx, peer, true, extraLogMessage);
      } catch (err) {
        this.library.logger.debug(err, tx);
      }
    }
  }

  /**
   * Checks tx is ok by normalizing it and eventually remove peer if tx is not valid
   * calls processUnconfirmedTransaction over it.
   * @returns {Promise<void>}
   */
  // tslint:disable-next-line max-line-length
  public async receiveTransaction(transaction: IBaseTransaction<any>, peer: Peer, bundled: boolean, extraLogMessage: string): Promise<string> {
    try {
      transaction = this.library.logic.transaction.objectNormalize(transaction);
    } catch (e) {
      this.library.logger.debug('Transaction normalization failed', {
        err   : e.toString(),
        id    : transaction.id,
        module: 'transport',
        tx    : transaction,
      });
      this.removePeer({ peer, code: 'ETRANSACTION' }, extraLogMessage);
      throw new Error(`Invalid transaction body ${e.message}`);
    }

    try {
      await this.library.balancesSequence.addAndPromise(async () => {
        this.library.logger.debug(`Received transaction ${transaction.id} from peer: ${peer.string}`);
        await this.modules.transactions.processUnconfirmedTransaction(
          transaction,
          true,
          bundled
        );
      });
      return transaction.id;
    } catch (err) {
      this.library.logger.debug(`Transaction ${transaction.id} error ${err}`, transaction);
      throw new Error(err);
    }
  }

  /**
   * Creates a sha256 hash sum from input object
   * The returned obj is not the sha256 but a manipulated number version of the sha256
   */
  private hashsum(obj: any): string {
    const buf  = Buffer.from(JSON.stringify(obj), 'utf8');
    const hash = crypto.createHash('sha256').update(buf).digest();
    const tmp  = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      tmp[i] = hash[7 - i];
    }
    return BigNum.fromBuffer(tmp).toString();
  }

  /**
   * Removes a peer by calling modules peer remove
   */
  private removePeer(options: { code: string, peer: Peer }, extraMessage: string) {
    this.library.logger.debug(`${options.code} Removing peer ${options.peer.string} ${extraMessage}`);
    this.modules.peers.remove(options.peer.ip, options.peer.port);
  }
}
