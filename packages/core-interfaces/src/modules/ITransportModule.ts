import {
  BasePeerType,
  ITransportTransaction,
  PeerState,
  PeerRequestOptions
} from '@risevision/core-types';
import { IPeerLogic, IAPIRequest } from '../logic';
import { IModule } from './IModule';

export interface ITransportModule extends IModule {

  getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }>;

  getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] },
                       requestHandler: IAPIRequest<any, any>): Promise<{ body: any; peer: IPeerLogic }>;

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
