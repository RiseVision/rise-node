import { ILogger, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig } from '@risevision/core-types';
import { decorate, inject, injectable, named } from 'inversify';
import {
  OnWPAction,
  WordPressHookSystem,
  WPHooksSubscriber,
} from 'mangiafuoco';
import { p2pSymbols } from '../../helpers';
import { PeersLogic } from '../../peersLogic';
import { PeersModel } from '../../PeersModel';
import { PingRequest } from '../../requests';
import { OnPeersReady } from '../actions';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class PeersLoaderSubscriber extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(p2pSymbols.logic.peersLogic)
  private peersLogic: PeersLogic;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @inject(p2pSymbols.transportMethod)
  @named(p2pSymbols.requests.ping)
  private pingRequest: PingRequest;

  @inject(ModelSymbols.model)
  @named(p2pSymbols.model)
  private PeersModel: typeof PeersModel;

  @OnWPAction('core/loader/onBlockchainReady')
  public async onBlockchainReady() {
    if (process.env.NODE_ENV !== 'test') {
      await this.insertSeeds();
      await this.dbLoad();

      await this.hookSystem.do_action(OnPeersReady.name);
    }
  }

  /**
   * Loads peers from db and calls ping on any peer.
   */
  public async dbLoad() {
    this.logger.trace('Importing peers from database');

    try {
      const rows = await this.PeersModel.findAll({ raw: true });
      let updated = 0;
      await Promise.all(
        rows
          .map((rawPeer) => this.peersLogic.create(rawPeer))
          .filter((peer) => !this.peersLogic.exists(peer))
          .map(async (peer) => {
            try {
              await peer.makeRequest(this.pingRequest);
              updated++;
            } catch (e) {
              this.logger.info(
                `Peer ${peer.string} seems to be unresponsive.`,
                e.message
              );
            }
          })
      );
      this.logger.trace('Peers->dbLoad Peers discovered', {
        total: rows.length,
        updated,
      });
    } catch (e) {
      this.logger.error('Import peers from database failed', {
        error: e.message || e,
      });
    }
  }

  public async insertSeeds() {
    this.logger.trace('Peers->insertSeeds');
    let updated = 0;
    await Promise.all(
      this.appConfig.peers.list.map(async (seed) => {
        const peer = this.peersLogic.create(seed);
        this.logger.trace(`Processing seed peer ${peer.string}`);
        // Sets the peer as connected. Seed can be offline but it will be removed later.
        try {
          await peer.makeRequest(this.pingRequest);
          updated++;
        } catch (e) {
          // seed peer is down?
          this.logger.warn(`Seed ${peer.string} is down`, e);
        }
      })
    );
    if (updated === 0) {
      throw new Error('No valid seed peers');
    }
    this.logger.info('Peers->insertSeeds - Peers discovered', {
      total: this.appConfig.peers.list.length,
      updated,
    });
  }
}
