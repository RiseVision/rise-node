import { IAPIRequest } from '../../../apis/requests/BaseRequest';
import { BasePeerType, PeerState, SignedBlockType } from '../../../logic';
import { IBaseTransaction, ITransportTransaction } from '../../../logic/transactions';
import { PeerRequestOptions } from '../../../modules';
import { IPeerLogic } from '../logic';
import { IModule } from './IModule';

export interface ITransportModule extends IModule {

  getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }>;

  getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] },
                       requestHandler: IAPIRequest<any, any>): Promise<{ body: any; peer: IPeerLogic }>;

  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean): void;

  /**
   * Calls enqueue if broadcast is true and did not exhaust relays
   * Be aware that the transaction object is modified by adding relays: number
   */
  onUnconfirmedTransaction(transaction: IBaseTransaction<any> & { relays?: number }, broadcast: boolean): void;

  /**
   * On new block get current broadhash, update system (to calc new broadhash) and broadcast block to all
   * peers on old broadhash.
   * Be aware that original block will be modified by adding relays if not there.
   */
  onNewBlock(block: SignedBlockType & { relays?: number }, broadcast: boolean): Promise<void>;

  receiveSignatures(signatures: Array<{ transaction: string, signature: string }>): Promise<void>;

  /**
   * Validate signature with schema and calls processSignature from module multisignautre
   */
  receiveSignature(signature: { transaction: string, signature: string }): Promise<void>;

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
