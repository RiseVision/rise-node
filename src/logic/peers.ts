import { inject, injectable } from 'inversify';
import * as ip from 'ip';
import * as _ from 'lodash';
import { ILogger } from '../helpers';
import { IPeerLogic, IPeersLogic } from '../ioc/interfaces/logic/';
import {ISystemModule} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { BasePeerType, PeerLogic, PeerState, PeerType } from './peer';

@injectable()
export class PeersLogic implements IPeersLogic {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  private peers: { [peerIdentifier: string]: IPeerLogic } = {};

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.logic.peerFactory)
  private peersFactory: (bp: BasePeerType) => IPeerLogic;

  public create(peer: BasePeerType): IPeerLogic {
    if (!(peer instanceof PeerLogic)) {
      return this.peersFactory(peer);
    }
    return peer as any;
  }

  /**
   * Checks if peer is in list
   */
  public exists(peer: BasePeerType): boolean {
    const thePeer = this.create(peer);
    return typeof(this.peers[thePeer.string]) !== 'undefined';
  }

  public get(peer: PeerType | string) {
    if (typeof(peer) === 'string') {
      return this.peers[peer];
    }
    return this.peers[this.create(peer).string];
  }

  public upsert(peer: PeerType, insertOnly: boolean) {

    const thePeer = this.create(peer);
    if (this.exists(thePeer)) {
      if (insertOnly) {
        return false;
      }
      // Update peer.
      thePeer.updated = Date.now();
      const diff      = {};
      Object.keys(peer)
        .filter((k) => k !== 'updated')
        .filter((k) => this.peers[thePeer.string][k] !== thePeer[k])
        .forEach((k: string) => diff[k] = thePeer[k]);

      this.peers[thePeer.string].update(thePeer);

      if (Object.keys(diff).length) {
        this.logger.debug(`Updated peer ${thePeer.string}`, diff);
      } else {
        this.logger.trace('Peer not changed', thePeer.string);
      }
    } else {
      // insert peer!
      if (!_.isEmpty(this.acceptable([thePeer]))) {
        thePeer.updated            = Date.now();
        this.peers[thePeer.string] = thePeer;
        this.logger.debug('Inserted new peer', thePeer.string);
      } else {
        this.logger.debug('Rejecting unacceptable peer', thePeer.string);
      }
    }

    const stats = {
      alive         : 0,
      emptyBroadhash: 0,
      emptyHeight   : 0,
      total         : 0,
    };

    Object.keys(this.peers)
      .map((key) => this.peers[key])
      .forEach((p: IPeerLogic) => {
        stats.total++;

        if (p.state === PeerState.CONNECTED) {
          stats.alive++;
        }
        if (!p.height) {
          stats.emptyHeight++;
        }
        if (!p.broadhash) {
          stats.emptyBroadhash++;
        }
      });

    this.logger.trace('PeerStats', stats);

    return true;

  }

  public remove(peer: BasePeerType): boolean {
    if (this.exists(peer)) {
      const thePeer = this.create(peer);
      this.logger.info('Removed peer', thePeer.string);
      this.logger.debug('Removed peer', { peer: this.peers[thePeer.string] });
      delete this.peers[thePeer.string];
      return true;
    }

    this.logger.debug('Failed to remove peer', { err: 'AREMOVED', peer });
    return false;
  }

  public list(normalize: true): PeerType[];
  public list(normalize: false): IPeerLogic[];
  public list(normalize: boolean) {
    return Object.keys(this.peers)
      .map((k) => this.peers[k])
      .map((peer) => normalize ? peer.object() : peer);
  }

  /**
   * Filters peers with private ips or same nonce
   */
  public acceptable(peers: PeerType[]): PeerType[] {
    return _(peers)
      .uniqWith((a, b) => `${a.ip}${a.port}` === `${b.ip}${b.port}`)
      .filter((peer) => {
        if ((process.env.NODE_ENV || '').toUpperCase() === 'TEST') {
          return peer.nonce !== this.systemModule.getNonce() && (peer.os !== 'lisk-js-api');
        }
        return !ip.isPrivate(peer.ip) && peer.nonce !== this.systemModule.getNonce() && (peer.os !== 'lisk-js-api');
      })
      .value();
  }

}
