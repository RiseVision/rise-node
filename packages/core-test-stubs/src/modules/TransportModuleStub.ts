import { IPeerLogic, ITransportModule, PeerRequestOptions } from '@risevision/core-interfaces';
import {
  BasePeerType,
  IBaseTransaction,
  ITransportTransaction,
  PeerState,
  SignedBlockType
} from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export default class TransportModuleStub extends BaseStubClass implements ITransportModule {
  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }> {
    return null;
  }

  @stubMethod()
  public getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }, options: PeerRequestOptions): Promise<{ body: any; peer: IPeerLogic }> {
    return null;
  }

  @stubMethod()
  public onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean): void {
    return null;
  }

  @stubMethod()
  public onUnconfirmedTransaction(transaction: IBaseTransaction<any> & { relays?: number }, broadcast: boolean): void {
    return null;
  }

  @stubMethod()
  public onNewBlock(block: SignedBlockType & { relays?: number }, broadcast: boolean): Promise<void> {
    return null;
  }

  @stubMethod()
  public receiveSignatures(signatures: Array<{ transaction: string, signature: string }>): Promise<void> {
    return null;
  }

  @stubMethod()
  public receiveSignature(signature: { transaction: string, signature: string }): Promise<void> {
    return null;
  }

  @stubMethod()
  public receiveTransactions(transactions: Array<ITransportTransaction<any>>, peer: IPeerLogic, broadcast: boolean): Promise<void> {
    return null;
  }

}