import { injectable } from 'inversify';
import { IAPIRequest } from '../../../src/apis/requests/BaseRequest';
import { IPeerLogic } from '../../../src/ioc/interfaces/logic';
import { ITransportModule } from '../../../src/ioc/interfaces/modules';
import { BasePeerType, PeerState, SignedBlockType } from '../../../src/logic';
import { IBaseTransaction, ITransportTransaction } from '../../../src/logic/transactions';
import { PeerRequestOptions } from '../../../src/modules';
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
  public getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] },
                              requestHandler: IAPIRequest<void, void>): Promise<{ body: any; peer: IPeerLogic }> {
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
