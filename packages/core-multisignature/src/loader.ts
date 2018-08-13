import { ILogger, ISequence, ITransportModule, Symbols } from '@risevision/core-interfaces';
import { inject, injectable, named } from 'inversify';
import z_schema from 'z-schema';
import { MultisigSymbols } from './helpers';
import { MultisignaturesModule } from './multisignatures';

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
  @named(Symbols.names.helpers.balancesSequence)
  private defaultSequence: ISequence;

  @inject(MultisigSymbols.module)
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
