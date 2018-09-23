import { ILogger, Symbols } from '@risevision/core-interfaces';
import { BroadcasterLogic, p2pSymbols } from '@risevision/core-p2p';
import { inject, injectable, named } from 'inversify';
import { PostSignaturesRequest } from './requests';
import { WordPressHookSystem } from 'mangiafuoco';
import { logOnly } from '@risevision/core-utils';

@injectable()
export class MultisigTransportModule {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;

  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  public async onSignature(signature: { transaction: string, signature: Buffer, relays?: number }, broadcast: boolean, postSigRequest: PostSignaturesRequest) {
    if (!broadcast) {
      return;
    }
    this.broadcasterLogic.maybeEnqueue(
      { body: signature },
      postSigRequest
    );
    await this.hookSystem.do_action('pushapi/onNewMessage', 'signature/change', signature)
      .catch(logOnly(this.logger, 'warn'));
  }
}
