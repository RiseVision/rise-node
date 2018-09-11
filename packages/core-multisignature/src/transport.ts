import { Symbols } from '@risevision/core-interfaces';
import { BroadcasterLogic, p2pSymbols } from '@risevision/core-p2p';
import { inject, injectable, named } from 'inversify';
import SocketIO from 'socket.io';
import { MultisigSymbols } from './helpers';
import { PostSignaturesRequest } from './requests/PostSignaturesRequest';

@injectable()
export class MultisigTransportModule {

  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;

  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;

  @inject(p2pSymbols.transportMethod)
  @named(MultisigSymbols.requests.postSignatures)
  private postSigRequest: PostSignaturesRequest;

  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  public onSignature(signature: { transaction: string, signature: Buffer, relays?: number }, broadcast: boolean) {
    if (!broadcast) {
      return;
    }
    this.broadcasterLogic.maybeEnqueue(
      { body: signature },
      this.postSigRequest
    );
    // TODO: Change with hookSystem message Event.
    this.io.sockets.emit('signature/change', signature);
  }
}
