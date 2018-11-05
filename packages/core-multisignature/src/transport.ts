import { ILogger, Symbols } from '@risevision/core-interfaces';
import { BroadcasterLogic, p2pSymbols } from '@risevision/core-p2p';
import { logOnly } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { MultisigSymbols } from './helpers';
import { PostSignaturesRequest } from './p2p';

@injectable()
export class MultisigTransportModule {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;
  @inject(p2pSymbols.transportMethod)
  @named(MultisigSymbols.p2p.postSignatures)
  private postSignatures: PostSignaturesRequest;

  /**
   * Calls enqueue signatures and emits a signature change socket message
   */
  public async onSignature(
    signature: { transaction: string; signature: Buffer; relays?: number },
    broadcast: boolean
  ) {
    if (!broadcast) {
      return;
    }
    this.broadcasterLogic.maybeEnqueue(
      { body: signature },
      this.postSignatures
    );
    await this.hookSystem
      .do_action('pushapi/onNewMessage', 'signature/change', signature)
      .catch(logOnly(this.logger, 'warn'));
  }
}
