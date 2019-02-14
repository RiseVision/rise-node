import { ILogger, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig, BasePeerType } from '@risevision/core-types';
import { resolveTxt } from 'dns';
import { decorate, inject, injectable, named } from 'inversify';
import {
  OnWPAction,
  WordPressHookSystem,
  WPHooksSubscriber,
} from 'mangiafuoco';
import { promisify } from 'util';
import { p2pSymbols } from '../../helpers';
import { PeersLogic } from '../../peersLogic';
import { PeersModel } from '../../PeersModel';
import { PingRequest } from '../../requests';
import { OnPeersReady } from '../actions';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

type ParsedTxtRecord = Map<string, string>;

@injectable()
export class PeersLoaderSubscriber extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  public resolveTxt = promisify(resolveTxt);

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
      await this.bootstrapPeers();
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

  /**
   * Parse TXT DNS records into a Map.
   *
   * The expected format of the TXT records is the following: `ip=1.2.3.4; port=1234`. That would get parsed into
   * `new Map([['ip', '1.2.3.4'], ['port', '1234']])`.
   *
   * @param rawRecordParts single record from dns.resolveTxt response
   * @returns a Map containing the string representation of keys and values
   */
  public parseTxtRecord(rawRecordParts: string[]): ParsedTxtRecord {
    const rawRecord = rawRecordParts.join('');
    // Parse raw record into a Map
    return new Map(
      rawRecord
        .split(';')
        .map((part) => part.split('=').map((p) => p.trim()))
        .filter((parts) => parts.length === 2)
        .map(
          (parts): Readonly<[string, string]> => [
            parts[0].toLowerCase(),
            parts[1],
          ]
        )
    );
  }

  /**
   * Try to parse peer data form a parsed TXT record.
   *
   * @param record Parsed TXT record data
   * @returns null when parsing failed, BasePeerType on success
   */
  public parsePeerData(record: ParsedTxtRecord): null | BasePeerType {
    const peer = {
      ip: record.get('ip'),
      port: parseInt(record.get('port'), 10),
    };
    if (peer.ip && !isNaN(peer.port)) {
      return peer;
    } else {
      return null;
    }
  }

  public async resolveSeeds(seeds: string[]): Promise<BasePeerType[]> {
    const directRegex = /^(.*):(\d+)$/;
    const peerArrays = await Promise.all(
      seeds.map(async (seed) => {
        const match = seed.match(directRegex);
        if (match) {
          return [
            {
              ip: match[1],
              port: parseInt(match[2], 10),
            },
          ];
        } else {
          this.logger.trace(`Peers->resolveSeeds - Querying ${seed} for peers`);
          let records = [];
          try {
            records = await this.resolveTxt(seed);
          } catch (e) {
            this.logger.warn(`Failed to resolve ${seed}`, e);
          }
          return records
            .map(this.parseTxtRecord)
            .map(this.parsePeerData)
            .filter((peer) => peer !== null);
        }
      })
    );

    const uniques = {};
    return peerArrays
      .reduce((peers, p) => peers.concat(p), [])
      .filter((peer) => {
        // Deduplicate the peers in case we discovered the same peer from multiple sources
        const k = `${peer.ip}:${peer.port}`;
        if (uniques[k]) {
          return false;
        } else {
          uniques[k] = true;
          return true;
        }
      });
  }

  public async bootstrapPeers() {
    this.logger.trace('Peers->bootstrapPeers');
    let reachable = 0;
    const peers = await this.resolveSeeds(this.appConfig.peers.seeds);
    await Promise.all(
      peers.map(async (peerData) => {
        const peer = this.peersLogic.create(peerData);
        this.logger.trace(`Processing seed peer ${peer.string}`);
        // Sets the peer as connected. Seed can be offline but it will be removed later.
        try {
          await peer.makeRequest(this.pingRequest);
          reachable++;
        } catch (e) {
          // seed peer is down?
          this.logger.warn(`Discovered peer ${peer.string} is down`, e);
        }
      })
    );
    if (reachable === 0) {
      throw new Error('No reachable seed peers');
    }
    this.logger.info('Peers->bootstrapPeers - Peers discovered', {
      discovered: peers.length,
      reachable,
      seeds: this.appConfig.peers.seeds.length,
    });
  }
}
