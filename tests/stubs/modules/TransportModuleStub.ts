import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { ITransportModule } from '../../../src/ioc/interfaces/modules';
import { IPeerLogic } from '../../../src/ioc/interfaces/logic';
import { IBaseTransaction } from '../../../src/logic/transactions';
import { PeerRequestOptions } from '../../../src/modules';
import { BasePeerType, PeerState, SignedBlockType } from '../../../src/logic';
import { stubMethod } from '../stubDecorator';

@injectable()
export default class TransportModuleStub extends BaseStubClass implements ITransportModule {
  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T; peer: IPeerLogic }> {
    return undefined;
  }

  @stubMethod()
  public getFromRandomPeer<T>(config: { limit?: number; broadhash?: string; allowedStates?: PeerState[] }, options: PeerRequestOptions): Promise<{ body: any; peer: IPeerLogic }> {
    return undefined;
  }

  @stubMethod()
  public onNewBlock(block: SignedBlockType & { relays?: number }, broadcast: boolean): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public onSignature(signature: { transaction: string; signature: string; relays?: number }, broadcast: boolean): void {
  }

  @stubMethod()
  public onUnconfirmedTransaction(transaction: IBaseTransaction<any> & { relays?: number }, broadcast: boolean): void {
  }

  @stubMethod()
  public receiveSignature(signature: { transaction: string; signature: string }): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public receiveSignatures(signatures: Array<{ transaction: string, signature: string }> ): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public receiveTransaction(transaction: IBaseTransaction<any>, peer: IPeerLogic, bundled: boolean, extraLogMessage: string): Promise<string> {
    return undefined;
  }

  @stubMethod()
  public receiveTransactions(transactions: Array<IBaseTransaction<any>>, peer: IPeerLogic, extraLogMessage: string): Promise<void> {
    return undefined;
  }

}
