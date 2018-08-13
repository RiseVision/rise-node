import { IBroadcasterLogic, Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import SocketIO from 'socket.io';

@injectable()
export class MultisigTransportModule {

  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: IBroadcasterLogic;

  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  public onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean) {
    signature.relays = signature.relays || 0;
    if (broadcast && signature.relays < this.broadcasterLogic.maxRelays()) {
      signature.relays++;
      this.broadcasterLogic.enqueue({}, { api: '/signatures', data: { signature }, method: 'POST' });
      this.io.sockets.emit('signature/change', signature);
    }
  }
}