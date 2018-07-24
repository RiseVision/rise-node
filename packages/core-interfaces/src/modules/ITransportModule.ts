import {
  BasePeerType,
  IBaseTransaction,
  ITransportTransaction,
  PeerState,
  SignedBlockType
} from '@risevision/core-types';
import { IPeerLogic } from '../logic';
import { IModule } from './IModule';

// tslint:disable-next-line interface-over-type-literal
export type PeerRequestOptions = { api?: string, url?: string, method: 'GET' | 'POST', data?: any };

export interface ITransportModule extends IModule {

  getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }>;

  getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] },
                       options: PeerRequestOptions): Promise<{ body: T; peer: IPeerLogic }>;

  /**
   * Loops over the received transactions, Checks tx is ok by normalizing it and eventually remove peer if tx is not valid
   * Also checks tx is not already confirmed.
   * calls processUnconfirmedTransaction over it.
   * @returns {Promise<void>}
   */
  receiveTransactions(transactions: Array<ITransportTransaction<any>>,
                      peer: IPeerLogic | null,
                      broadcast: boolean): Promise<void>;

}
