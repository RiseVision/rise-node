import { Sequence, Symbols } from '@risevision/core-helpers';
import { ILogger, ITransportModule } from '@risevision/core-interfaces';
import { inject, injectable, tagged } from 'inversify';
import z_schema from 'z-schema';
import { MultisignaturesModule } from './multisignatures';
import { multisigSymbols } from './helpers';

const loaderSchema = require('../schema/loader.json');

@injectable()
export class MultisigLoader {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  private defaultSequence: Sequence;

  @inject(multisigSymbols.module)
  private multisigModule: MultisignaturesModule;
  /**
   * Loads pending multisignature transactions
   */
  private async loadSignatures() {
    this.logger.log('Loading signatures');
    const res = await this.transportModule.getFromRandomPeer<any>(
      {},
      {
        api   : '/signatures',
        method: 'GET',
      });

    if (!this.schema.validate(res.body, loaderSchema.loadSignatures)) {
      throw new Error('Failed to validate /signatures schema');
    }

    // FIXME: signatures array
    const { signatures }: { signatures: any[] } = res.body;

    // Process multisignature transactions and validate signatures in sequence
    await this.defaultSequence.addAndPromise(async () => {
      for (const multiSigTX of signatures) {
        for (const signature of  multiSigTX.signatures) {
          try {
            await this.multisigModule.processSignature({
              signature,
              transaction: multiSigTX.transaction,
            });
          } catch (err) {
            this.logger.warn(`Cannot process multisig signature for ${multiSigTX.transaction} `, err);
          }
        }
      }
      return void 0;
    });
  }
}
