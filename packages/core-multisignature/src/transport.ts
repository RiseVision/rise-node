import { IBroadcasterLogic, Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import SocketIO from 'socket.io';
import { RequestFactoryType } from '@risevision/core-p2p';
import { PostSignaturesRequest, PostSignaturesRequestDataType } from './requests/PostSignaturesRequest';
import { MultisigSymbols } from './helpers';

@injectable()
export class MultisigTransportModule {

  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: IBroadcasterLogic;

  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;

  @inject(MultisigSymbols.requests.postSignatures)
  private postSigsRequestFactory: RequestFactoryType<PostSignaturesRequestDataType, PostSignaturesRequest>

  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  public onSignature(signature: { transaction: string, signature: string, relays?: number }, broadcast: boolean) {
    signature.relays = signature.relays || 0;
    if (broadcast && signature.relays < this.broadcasterLogic.maxRelays()) {
      signature.relays++;
      this.broadcasterLogic.enqueue({},
        {
          immediate: false,
          requestHandler: this.postSigsRequestFactory({
            data: {
              signature: {
                relays: signature.relays,
                signature: Buffer.from(signature.signature, 'hex'),
                transaction: signature.transaction,
              },
            },
          }),
        }
      );
      this.io.sockets.emit('signature/change', signature);
    }
  }
}
